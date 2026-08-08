-- ============================================================
-- DalConnect — request-and-quote model
--
-- Customers no longer browse professionals. They pick a service, describe the
-- job, choose how urgently they need it, and every nearby professional in that
-- trade is invited to quote. Quotes are a PRICE RANGE + arrival time + notes.
-- The customer reviews the responders, accepts one, and only then is the
-- professional's phone number revealed so the two can arrange the job directly.
-- ============================================================

-- ---------- urgency ----------
do $$ begin
  create type booking_urgency as enum ('same_day', 'scheduled');
exception when duplicate_object then null; end $$;

alter table bookings
  add column if not exists urgency booking_urgency not null default 'scheduled',
  -- platform fee the customer pays for placing the request; snapshotted at
  -- creation so later price-list changes never rewrite past bookings
  add column if not exists service_fee numeric(10,2) not null default 0,
  -- the accepted quote's range (copied from the offer on acceptance)
  add column if not exists price_min numeric(10,2),
  add column if not exists price_max numeric(10,2),
  -- what was actually charged, entered on completion — commission is based on this
  add column if not exists final_price numeric(10,2);

-- ---------- quotes are ranges ----------
alter table offers
  add column if not exists price_min numeric(10,2),
  add column if not exists price_max numeric(10,2);

-- carry existing single prices into the range shape
update offers set price_min = coalesce(price_min, price),
                  price_max = coalesce(price_max, price)
where price_min is null or price_max is null;

-- `price` is superseded by the range; keep the column for old rows but stop requiring it
alter table offers alter column price drop not null;

alter table offers drop constraint if exists offers_price_range_valid;
alter table offers add constraint offers_price_range_valid
  check (price_min is null or price_max is null or price_min <= price_max);

-- ---------- configurable request fees (amounts are placeholders) ----------
insert into app_settings (key, value) values
  ('fee_same_day',  '0'),
  ('fee_scheduled', '0')
on conflict (key) do nothing;

create or replace function request_fee(p_urgency booking_urgency) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (value)::text::numeric from app_settings
      where key = case when p_urgency = 'same_day' then 'fee_same_day' else 'fee_scheduled' end),
    0);
$$;

-- stamp the fee at creation time from the current price list
create or replace function set_request_fee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.service_fee is null or new.service_fee = 0 then
    new.service_fee := request_fee(new.urgency);
  end if;
  return new;
end;
$$;

drop trigger if exists set_request_fee_trigger on bookings;
create trigger set_request_fee_trigger
  before insert on bookings
  for each row execute function set_request_fee();

-- ---------- accepting a quote ----------
create or replace function accept_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o offers%rowtype; b bookings%rowtype;
begin
  select * into o from offers where id = p_offer_id for update;
  if not found then raise exception 'offer not found'; end if;
  select * into b from bookings where id = o.booking_id for update;
  if b.customer_id <> auth.uid() then raise exception 'not your booking'; end if;
  if b.status <> 'open' then raise exception 'booking is not open'; end if;

  update offers set status = 'accepted' where id = o.id;
  -- every other quote is closed out; the customer picked one
  update offers set status = 'rejected'
    where booking_id = b.id and id <> o.id and status = 'pending';

  update bookings set
    status = 'accepted',
    professional_id = o.professional_id,
    price_min = o.price_min,
    price_max = o.price_max,
    price = coalesce(o.price, o.price_min),  -- legacy column: keep something sensible
    accepted_at = now()
  where id = b.id;
end;
$$;

-- ---------- declining a single quote (booking stays open) ----------
create or replace function decline_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o offers%rowtype; b bookings%rowtype;
begin
  select * into o from offers where id = p_offer_id for update;
  if not found then raise exception 'offer not found'; end if;
  select * into b from bookings where id = o.booking_id;
  if b.customer_id <> auth.uid() then raise exception 'not your booking'; end if;
  if o.status <> 'pending' then raise exception 'offer is not pending'; end if;

  update offers set status = 'rejected' where id = o.id;
end;
$$;

-- ---------- contact reveal ----------
-- The phone number is the thing of value here: it is handed over only once the
-- customer has accepted a quote, and only to the two parties involved.
create or replace function get_contact_phone(p_booking_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare b bookings%rowtype; uid uuid := auth.uid(); target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into b from bookings where id = p_booking_id;
  if not found then raise exception 'booking not found'; end if;
  if b.professional_id is null then return null; end if;
  -- contact details unlock on acceptance and stay available afterwards
  if b.status not in ('accepted', 'on_the_way', 'in_progress', 'completed', 'rated') then
    return null;
  end if;

  if uid = b.customer_id then
    target := b.professional_id;
  elsif uid = b.professional_id then
    target := b.customer_id;
  else
    raise exception 'not a party to this booking';
  end if;

  return (select phone from profiles where id = target);
end;
$$;

-- ---------- commission now follows the final agreed price ----------
create or replace function complete_booking_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare basis numeric;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := now();
    -- prefer what was actually charged; fall back to the quoted range/legacy price
    basis := coalesce(new.final_price, new.price, new.price_min);
    if basis is not null and new.professional_id is not null then
      new.price := coalesce(new.price, basis);
      new.commission := round(basis * commission_rate(), 2);
      insert into transactions (professional_id, booking_id, amount, commission, net)
      values (new.professional_id, new.id, basis, new.commission, basis - new.commission)
      on conflict (booking_id) do update
        set amount = excluded.amount,
            commission = excluded.commission,
            net = excluded.net;
      update professionals set jobs_completed = jobs_completed + 1 where id = new.professional_id;
    end if;
  end if;
  return new;
end;
$$;

-- ---------- quote notification carries the range ----------
create or replace function notify_new_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare cust uuid; range_txt text; eta_ar text; eta_he text;
begin
  select b.customer_id into cust from bookings b where b.id = new.booking_id;

  range_txt := case
    when new.price_min is not null and new.price_max is not null and new.price_min <> new.price_max
      then '₪' || trim(to_char(new.price_min, 'FM999999990')) || ' – ₪' || trim(to_char(new.price_max, 'FM999999990'))
    else '₪' || trim(to_char(coalesce(new.price_min, new.price_max, new.price, 0), 'FM999999990'))
  end;

  eta_ar := range_txt || case when new.eta_minutes is not null
              then ' · خلال ' || new.eta_minutes || ' د' else '' end;
  eta_he := range_txt || case when new.eta_minutes is not null
              then ' · תוך ' || new.eta_minutes || ' דק׳' else '' end;

  perform notify_user(cust, 'offer', 'عرض سعر جديد', 'הצעת מחיר חדשה', eta_ar, eta_he,
                      jsonb_build_object('bookingId', new.booking_id, 'offerId', new.id));
  return new;
end;
$$;

-- ---------- same-day requests reach every available pro in the trade ----------
-- (city match is a preference, not a hard filter, so an urgent job is never
-- left unanswered just because no one in that exact town is free)
create or replace function notify_new_open_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare snippet text; title_ar text; title_he text;
begin
  snippet := left(coalesce(nullif(new.title, ''), new.description), 90);
  if new.status = 'open' then
    if new.urgency = 'same_day' then
      title_ar := 'طلب عاجل بالقرب منك';
      title_he := 'בקשה דחופה באזורך';
    else
      title_ar := 'طلب جديد بالقرب منك';
      title_he := 'בקשה חדשה באזורך';
    end if;

    insert into notifications (user_id, type, title, body, title_ar, title_he, body_ar, body_he, data)
    select pc.professional_id, 'offer',
      title_ar, snippet, title_ar, title_he, snippet, snippet,
      jsonb_build_object('bookingId', new.id)
    from professional_categories pc
    join professionals pr on pr.id = pc.professional_id
    where pc.category_id = new.category_id
      and pr.is_available
      and (new.urgency = 'same_day'
           or new.city_id is null or pr.city_id is null or pr.city_id = new.city_id)
      and pr.id <> new.customer_id;
  end if;
  return new;
end;
$$;
