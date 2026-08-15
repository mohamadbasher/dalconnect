-- ============================================================
-- DalConnect — column guards for professionals, offers and profiles
--
-- Found by empirically probing the live database as a real signed-in user
-- (scripts/security-audit.mjs). Same class of hole as 20260714000008: the RLS
-- policies say WHICH ROWS you may update and nothing about WHICH COLUMNS, so
-- `professionals_update_self` and `offers_update_own` let their owner rewrite
-- anything on their own row. Confirmed working before this migration:
--
--   * a professional could set verification_status = 'approved' — self-issuing
--     the blue "verified" badge that vouches for them to customers
--   * a professional could set rating_avg = 5.0, rating_count = 999,
--     jobs_completed = 9999 — forging the only trust signals a customer has
--   * a professional could set featured = true — self-granting paid placement
--   * a professional could rewrite price_min/price_max on an ALREADY-ACCEPTED
--     offer, so the customer agreed to one number and could be billed another
--   * a professional could set their own offer's status = 'accepted',
--     bypassing the customer choosing at all
--   * any user could set their own profiles.phone_verified = true
--
-- role and is_banned were already protected by protect_profile_fields.
-- ============================================================

-- ---------- professionals ----------
create or replace function guard_professional_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('dalconnect.trusted_write', true), '') = 'on' then
    return new;
  end if;
  if is_admin() or auth.uid() is null then
    return new;
  end if;

  -- Reputation is computed by the platform from real reviews and real completed
  -- jobs (review_effects / complete_booking_effects, both of which mark their
  -- transaction trusted). It is never the professional's to type.
  if new.rating_avg      is distinct from old.rating_avg
  or new.rating_count    is distinct from old.rating_count
  or new.jobs_completed  is distinct from old.jobs_completed then
    raise exception 'reputation is computed from reviews and completed jobs, not set directly'
      using errcode = '42501';
  end if;

  -- Paid placement is sold, not claimed.
  if new.featured       is distinct from old.featured
  or new.featured_until is distinct from old.featured_until
  or new.featured_sort  is distinct from old.featured_sort then
    raise exception 'featured placement is granted by the platform'
      using errcode = '42501';
  end if;

  -- A professional may SUBMIT themselves for review ('pending', which is what
  -- uploading an ID document does in pro-settings) but may never be the one who
  -- approves it — that badge is a claim made TO customers ABOUT them.
  if new.verification_status is distinct from old.verification_status
     and new.verification_status <> 'pending' then
    raise exception 'only an admin can approve or reject verification'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_professional_update_trigger on professionals;
create trigger guard_professional_update_trigger
  before update on professionals
  for each row execute function guard_professional_update();

-- ---------- offers ----------
create or replace function guard_offer_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('dalconnect.trusted_write', true), '') = 'on' then
    return new;
  end if;
  if is_admin() or auth.uid() is null then
    return new;
  end if;

  if old.professional_id = auth.uid() then
    -- A quote is an offer to a specific customer. Once it stops being pending
    -- — accepted, declined or withdrawn — its terms are history, not a draft.
    if old.status <> 'pending' then
      raise exception 'a quote can only be changed while it is still pending'
        using errcode = '42501';
    end if;
    -- Accepting and rejecting belong to the customer, through accept_offer /
    -- decline_offer. The professional's only status move is to pull out.
    if new.status is distinct from old.status and new.status <> 'withdrawn' then
      raise exception 'only the customer can accept or decline a quote'
        using errcode = '42501';
    end if;
    if new.booking_id is distinct from old.booking_id
    or new.professional_id is distinct from old.professional_id then
      raise exception 'a quote cannot be moved to another booking or professional'
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'not your quote' using errcode = '42501';
end;
$$;

drop trigger if exists guard_offer_update_trigger on offers;
create trigger guard_offer_update_trigger
  before update on offers
  for each row execute function guard_offer_update();

-- ---------- profiles: phone_verified ----------
-- Extends the existing protect_profile_fields (role, is_banned) with the
-- verification flag. Re-declared verbatim plus the new check.
create or replace function protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then return new; end if;
  if new.role is distinct from old.role and not (old.role = 'customer' and new.role = 'professional') then
    raise exception 'role change not allowed';
  end if;
  if new.is_banned is distinct from old.is_banned then
    raise exception 'ban change not allowed';
  end if;
  -- Whether a phone number was proven to belong to this person is a fact the
  -- platform establishes (an OTP), never something the account asserts about
  -- itself. It is currently always false; this stops it being trivially true.
  if new.phone_verified is distinct from old.phone_verified
     and coalesce(current_setting('dalconnect.trusted_write', true), '') <> 'on' then
    raise exception 'phone verification is set by the platform, not the account';
  end if;
  return new;
end;
$$;

-- ---------- let the trusted paths through ----------
-- decline_offer writes offers.status as the CUSTOMER, which guard_offer_update
-- would otherwise reject ("not your quote"). Re-declared verbatim from
-- 20260714000005 apart from the first statement.
create or replace function decline_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o offers%rowtype; b bookings%rowtype;
begin
  perform trusted_write_on();
  select * into o from offers where id = p_offer_id for update;
  if not found then raise exception 'offer not found'; end if;
  select * into b from bookings where id = o.booking_id;
  if b.customer_id <> auth.uid() then raise exception 'not your booking'; end if;
  if o.status <> 'pending' then raise exception 'offer is not pending'; end if;

  update offers set status = 'rejected' where id = o.id;
end;
$$;

-- complete_booking_effects increments professionals.jobs_completed while
-- running as the professional, which guard_professional_update would reject as
-- reputation forgery. Re-declared verbatim apart from the first statement.
create or replace function complete_booking_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare basis numeric;
begin
  perform trusted_write_on();
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

-- ---------- become_professional ----------
-- Providers now register on their own track from the login screen (their own
-- 6-digit ID). Converting a customer account into a professional is no longer
-- offered anywhere in the UI, but the RPC was still callable directly — which
-- would create a professional with no provider_no, outside that flow.
-- Revoked from PUBLIC, not just anon/authenticated: Postgres grants EXECUTE on
-- new functions to PUBLIC by default, and those two roles inherit it — so
-- revoking from them alone leaves the function just as callable as before.
revoke execute on function become_professional(text, text, integer, integer[], text) from public, anon, authenticated;
