-- ============================================================
-- DalConnect — a provider cannot work until an admin approves them
--
-- handle_new_user already creates every provider with
-- verification_status = 'pending', and the admin panel already has an approve
-- button. What was missing is the part that makes that mean anything: nothing
-- checked the status. Verified against the live database — an account created
-- one minute ago, vetted by nobody, could read every open request in its
-- trades, send quotes on them, and receive a push for each new one.
--
-- That is the whole trust proposition of the product. A customer accepting a
-- quote is agreeing to let a stranger into their home, and "we check our
-- professionals" has to be true before it is said.
--
-- Three places had to change, because blocking only one leaves the others as
-- the way round:
--   1. reading open requests  (bookings_read)
--   2. sending a quote        (offers_insert)
--   3. being told about work  (notify_new_open_booking)
-- ============================================================

create or replace function is_approved_pro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from professionals
     where id = auth.uid()
       and verification_status = 'approved'
  );
$$;

comment on function is_approved_pro() is
  'True when the caller is a professional an admin has approved. The gate on
   every professional-side capability.';

-- ---------- 1. open requests are only visible to approved professionals ----------
drop policy if exists bookings_read on bookings;
create policy bookings_read on bookings for select using (
  customer_id = auth.uid()
  or professional_id = auth.uid()
  or is_admin()
  or (
    status = 'open'
    and is_approved_pro()
    and exists (
      select 1 from professional_categories pc
       where pc.professional_id = auth.uid()
         and pc.category_id = bookings.category_id
    )
  )
);

-- ---------- 2. only an approved professional may quote ----------
drop policy if exists offers_insert on offers;
create policy offers_insert on offers for insert with check (
  professional_id = auth.uid() and is_approved_pro()
);

-- ---------- 3. and only they are told about new work ----------
-- Re-declared from 20260714000004 with the verification filter added.
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
      and pr.verification_status = 'approved'   -- vetted only
      and (new.urgency = 'same_day'
           or new.city_id is null or pr.city_id is null or pr.city_id = new.city_id)
      and pr.id <> new.customer_id;
  end if;
  return new;
end;
$$;

-- The same filter on the city-moved re-notification, or that becomes the way in.
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
      and pr.verification_status = 'approved'
      and pr.id <> new.customer_id
      and (new.city_id is null or pr.city_id is null or pr.city_id = new.city_id)
      and not (old.city_id is null or pr.city_id is null or pr.city_id = old.city_id);
  end if;
  return new;
end;
$$;
