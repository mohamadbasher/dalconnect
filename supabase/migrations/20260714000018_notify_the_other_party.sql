-- ============================================================
-- DalConnect — tell the OTHER party, not the one who just acted
--
-- Found while walking the flow: a customer accepted a quote, and the
-- professional was never told. The customer got "הבקשה שלך אושרה" — which they
-- already knew, having just tapped the button — and the person who had actually
-- won a job, and has to turn up for it, heard nothing.
--
-- notify_booking_status routed 'accepted' to new.customer_id along with
-- on_the_way / in_progress / completed. That grouping holds for the others,
-- which the PROFESSIONAL sets, so the customer is the one who needs telling.
-- 'accepted' is the odd one: the CUSTOMER sets it.
--
-- 'completed' has since become ambiguous too — migration 20260714000009 let
-- customers confirm a job is finished, so it can now be either party. Rather
-- than guess, it notifies whoever did not do it.
-- ============================================================

create or replace function notify_booking_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  msg_ar text;
  msg_he text;
  snippet text;
  actor uuid := auth.uid();
begin
  if new.status = old.status then return new; end if;
  snippet := left(coalesce(nullif(new.title, ''), new.description), 90);

  if new.status = 'accepted' then
    -- The customer chose them. They are the one who needs to know.
    target := new.professional_id;
    msg_ar := 'تم قبول عرضك — الشغل إلك';
    msg_he := 'הצעת המחיר שלכם התקבלה — העבודה שלכם';

  elsif new.status in ('on_the_way', 'in_progress') then
    -- Set by the professional; the customer is waiting on exactly this.
    target := new.customer_id;
    msg_ar := case new.status
      when 'on_the_way'  then 'المهني في الطريق إليك'
      else 'بدأ العمل' end;
    msg_he := case new.status
      when 'on_the_way'  then 'בעל המקצוע בדרך אליך'
      else 'העבודה החלה' end;

  elsif new.status = 'completed' then
    -- Either side can close a job now, so tell whichever one didn't.
    if actor is not null and actor = new.customer_id then
      target := new.professional_id;
      msg_ar := 'أكّد الزبون إنه الشغل خلص';
      msg_he := 'הלקוח אישר שהעבודה הושלמה';
    else
      target := new.customer_id;
      msg_ar := 'اكتمل العمل — قيّم الخدمة';
      msg_he := 'העבודה הושלמה — דרגו את השירות';
    end if;

  elsif new.status = 'rejected' then
    target := new.customer_id;
    msg_ar := 'عذراً، تم رفض الطلب';
    msg_he := 'הבקשה נדחתה';

  elsif new.status = 'cancelled' and new.professional_id is not null then
    target := new.professional_id;
    msg_ar := 'قام العميل بإلغاء الحجز';
    msg_he := 'הלקוח ביטל את ההזמנה';

  else
    return new;
  end if;

  -- professional_id is null on a request nobody has taken yet
  if target is null then return new; end if;

  perform notify_user(target, 'booking_update', msg_ar, msg_he, snippet, snippet,
                      jsonb_build_object('bookingId', new.id));
  return new;
end;
$$;

-- ---------- a declined quote should say so ----------
-- decline_offer left the professional to work it out from the quote quietly
-- changing state. Re-declared from 20260714000010 with the notification added.
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

  perform notify_user(
    o.professional_id, 'offer',
    'ما انقبل عرضك على هذا الطلب', 'הצעת המחיר שלכם לא נבחרה',
    left(coalesce(nullif(b.title, ''), b.description), 90),
    left(coalesce(nullif(b.title, ''), b.description), 90),
    jsonb_build_object('bookingId', b.id)
  );
end;
$$;
