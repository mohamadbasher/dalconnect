-- ============================================================
-- DalConnect — customer can confirm a job is done
--
-- Until now only the professional could close out a job (job/[id].tsx sets
-- status='completed' with the final_price they charged). This adds the
-- customer's side of that: once the pro is on_the_way or in_progress, the
-- customer can confirm the work is finished from their own booking screen.
--
-- guard_booking_update (20260714000008) already blocks a customer from ever
-- writing final_price/commission/price_min/price_max — that check is untouched
-- here, so this path is money-safe by construction: final_price stays null,
-- and complete_booking_effects' existing fallback
-- (coalesce(final_price, price, price_min)) bills the LOW end of the quoted
-- range. That's a deliberate default, not an oversight — if the professional
-- wants the real final price recorded, their own completion flow still does
-- that; a customer-side confirmation without it should favour the customer,
-- not the platform.
-- ============================================================

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

  if uid is null then
    return new;
  end if;

  -- ---------- the assigned professional ----------
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
    -- Money and assignment are never the customer's to write, cancelling or
    -- confirming completion included.
    if new.professional_id is distinct from old.professional_id
    or new.service_fee     is distinct from old.service_fee
    or new.commission      is distinct from old.commission
    or new.final_price     is distinct from old.final_price
    or new.price_min       is distinct from old.price_min
    or new.price_max       is distinct from old.price_max then
      raise exception 'customers may not set prices or assign professionals'
        using errcode = '42501';
    end if;

    -- A customer may cancel (before work starts) or confirm completion (once
    -- it has) — nothing else changes booking.status from their side.
    if new.status is distinct from old.status then
      if new.status = 'cancelled' then
        if old.status not in ('open', 'pending', 'accepted') then
          raise exception 'a job in progress or finished cannot be cancelled here'
            using errcode = '42501';
        end if;
      elsif new.status = 'completed' then
        if old.status not in ('on_the_way', 'in_progress') then
          raise exception 'only a job actually underway can be confirmed done by the customer'
            using errcode = '42501';
        end if;
      else
        raise exception 'customers may only cancel or confirm completion, not set status %', new.status
          using errcode = '42501';
      end if;
    end if;

    -- Editing the request itself: only while it is still open.
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
