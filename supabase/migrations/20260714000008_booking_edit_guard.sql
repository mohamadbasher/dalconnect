-- ============================================================
-- DalConnect — who may change what on a booking
--
-- `bookings_update_parties` checks WHICH ROWS you may update but says nothing
-- about WHICH COLUMNS. Verified against the live database, a signed-in customer
-- could run:
--
--   update bookings set status = 'completed', final_price = 0, commission = 0
--
-- on their own row — closing their own job and paying the platform nothing.
-- They could also write price_min/price_max and service_fee. RLS alone cannot
-- express "these columns, in these statuses", so this adds a BEFORE UPDATE
-- trigger that does.
--
-- It is also the precondition for letting customers EDIT a request they've
-- already sent: without it, "the customer may update their booking" means
-- "the customer may write anything".
-- ============================================================

-- ---------- trusted server-side writes ----------
-- accept_offer & friends are SECURITY DEFINER but auth.uid() still returns the
-- caller, so the guard below would block them. They mark their transaction as
-- trusted; `true` scopes the setting to the transaction, so it cannot leak.
create or replace function trusted_write_on() returns void
language sql security definer set search_path = public as $$
  select set_config('dalconnect.trusted_write', 'on', true);
$$;

create or replace function guard_booking_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if coalesce(current_setting('dalconnect.trusted_write', true), '') = 'on' then
    return new;
  end if;
  if is_admin() then
    return new;
  end if;

  -- No JWT: the service-role key, or a maintenance script. It already bypasses
  -- RLS entirely, and `bookings_update_parties` blocks anonymous callers before
  -- they ever reach this trigger, so a null uid here can only be the platform
  -- acting on its own behalf. Without this, the admin panel's first booking
  -- action would fail with "not a party to this booking".
  if uid is null then
    return new;
  end if;

  -- ---------- the assigned professional ----------
  -- Moves the job along and records what was charged. Never touches the money
  -- the platform computes, nor who the job belongs to.
  if old.professional_id is not null and old.professional_id = uid then
    if new.customer_id     is distinct from old.customer_id
    or new.professional_id is distinct from old.professional_id
    or new.category_id     is distinct from old.category_id
    or new.service_fee     is distinct from old.service_fee
    or new.commission      is distinct from old.commission
    or new.price_min       is distinct from old.price_min
    or new.price_max       is distinct from old.price_max then
      raise exception 'professionals may only advance the job, not change its terms'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- ---------- the customer ----------
  if old.customer_id = uid then
    -- Money and assignment are never the customer's to write. This is the hole.
    if new.professional_id is distinct from old.professional_id
    or new.service_fee     is distinct from old.service_fee
    or new.commission      is distinct from old.commission
    or new.final_price     is distinct from old.final_price
    or new.price_min       is distinct from old.price_min
    or new.price_max       is distinct from old.price_max then
      raise exception 'customers may not set prices or assign professionals'
        using errcode = '42501';
    end if;

    -- The only status a customer may write is 'cancelled' (accept_offer does
    -- the rest through the trusted path), and only before work has started.
    if new.status is distinct from old.status then
      if new.status <> 'cancelled' then
        raise exception 'customers may only cancel, not set status %', new.status
          using errcode = '42501';
      end if;
      if old.status not in ('open', 'pending', 'accepted') then
        raise exception 'a job in progress or finished cannot be cancelled here'
          using errcode = '42501';
      end if;
    end if;

    -- Editing the request itself: only while it is still open. Once a quote is
    -- accepted, the professional priced the job as described — moving the goal
    -- posts underneath them is not an edit, it is a new request.
    if old.status <> 'open' and (
         new.title        is distinct from old.title
      or new.description  is distinct from old.description
      or new.photos       is distinct from old.photos
      or new.city_id      is distinct from old.city_id
      or new.address      is distinct from old.address
      or new.lat          is distinct from old.lat
      or new.lng          is distinct from old.lng
      or new.scheduled_at is distinct from old.scheduled_at
    ) then
      raise exception 'a request can only be edited while it is still open'
        using errcode = '42501';
    end if;

    -- The trade and the urgency are fixed at creation. The trade decides who
    -- was invited to quote; the urgency is what service_fee was stamped from.
    -- Changing either would silently invalidate work already done.
    if new.category_id is distinct from old.category_id
    or new.urgency     is distinct from old.urgency then
      raise exception 'the service and the timing cannot be changed after sending'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'not a party to this booking' using errcode = '42501';
end;
$$;

-- The "a_" prefix is load-bearing. Postgres fires BEFORE triggers in NAME order,
-- and complete_booking_effects (as booking_completion_trigger) computes
-- new.commission and new.price on the way to 'completed'. If the guard ran
-- after it, it would see the trigger's own arithmetic as if the professional
-- had typed it and reject a legitimate completion. Running first means the
-- guard judges what the CLIENT sent, which is the only thing worth judging.
drop trigger if exists guard_booking_update_trigger on bookings;
drop trigger if exists a_guard_booking_update_trigger on bookings;
create trigger a_guard_booking_update_trigger
  before update on bookings
  for each row execute function guard_booking_update();

-- ---------- let the trusted RPCs through ----------
-- Re-declared verbatim from 20260714000005 apart from the first statement.
create or replace function accept_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o offers%rowtype; b bookings%rowtype;
begin
  perform trusted_write_on();
  select * into o from offers where id = p_offer_id for update;
  if not found then raise exception 'offer not found'; end if;
  select * into b from bookings where id = o.booking_id for update;
  if b.customer_id <> auth.uid() then raise exception 'not your booking'; end if;
  if b.status <> 'open' then raise exception 'booking is not open'; end if;

  update bookings set
    professional_id = o.professional_id,
    status          = 'accepted',
    price_min       = o.price_min,
    price_max       = o.price_max,
    price           = coalesce(o.price_min, o.price),
    accepted_at     = now()
  where id = b.id;

  update offers set status = 'accepted' where id = o.id;
  update offers set status = 'rejected' where booking_id = b.id and id <> o.id and status = 'pending';
end;
$$;

-- review_effects flips a completed job to 'rated' while running as the reviewer.
-- Re-declared verbatim from 20260714000004 apart from the first statement.
create or replace function review_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare pro_id uuid;
begin
  perform trusted_write_on();
  pro_id := coalesce(new.professional_id, old.professional_id);
  update professionals p set
    rating_avg = coalesce(sub.avg, 0), rating_count = coalesce(sub.cnt, 0)
  from (select avg(rating)::numeric(3,2) as avg, count(*) as cnt
        from reviews where professional_id = pro_id and status = 'published') sub
  where p.id = pro_id;
  if tg_op = 'INSERT' then
    update bookings set status = 'rated' where id = new.booking_id and status = 'completed';
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------- re-notify when an open request moves city ----------
-- notify_new_open_booking only fires on INSERT. Without this, a customer who
-- corrects the city on a live request keeps the professionals from the old city
-- (who can no longer help) and never reaches the new one.
--
-- Same-day requests are exempt: notify_new_open_booking deliberately ignores
-- city for those and tells every available professional in the trade, so there
-- is nobody left to reach.
create or replace function notify_open_booking_moved() returns trigger
language plpgsql security definer set search_path = public as $$
declare snippet text;
begin
  if new.status = 'open'
     and new.urgency <> 'same_day'
     and new.city_id is distinct from old.city_id then
    snippet := left(coalesce(nullif(new.title, ''), new.description), 90);
    insert into notifications (user_id, type, title, body, title_ar, title_he, body_ar, body_he, data)
    select pc.professional_id, 'offer',
      'طلب جديد بالقرب منك', snippet,
      'طلب جديد بالقرب منك', 'בקשה חדשה באזורך', snippet, snippet,
      jsonb_build_object('bookingId', new.id)
    from professional_categories pc
    join professionals pr on pr.id = pc.professional_id
    where pc.category_id = new.category_id
      and pr.is_available
      and pr.id <> new.customer_id
      -- reaches the new city…
      and (new.city_id is null or pr.city_id is null or pr.city_id = new.city_id)
      -- …but was not already told on insert
      and not (old.city_id is null or pr.city_id is null or pr.city_id = old.city_id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_open_booking_moved_trigger on bookings;
create trigger notify_open_booking_moved_trigger
  after update on bookings
  for each row execute function notify_open_booking_moved();
