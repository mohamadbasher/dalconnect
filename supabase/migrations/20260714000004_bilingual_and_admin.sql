-- ============================================================
-- DalConnect — bilingual notifications, legal CMS, audit log,
-- review moderation, promoted pros, granular staff permissions.
-- (Patterns adapted from the sibling "Dal" marketplace.)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bilingual notifications
-- Previously title/body held BOTH languages concatenated, so a
-- Hebrew user saw Arabic too. Store each language separately and
-- let the client pick.
-- ------------------------------------------------------------
alter table notifications
  add column if not exists title_ar text,
  add column if not exists title_he text,
  add column if not exists body_ar  text,
  add column if not exists body_he  text;

-- backfill existing rows (old values were bilingual strings)
update notifications
set title_ar = coalesce(title_ar, title),
    title_he = coalesce(title_he, title),
    body_ar  = coalesce(body_ar, body),
    body_he  = coalesce(body_he, body)
where title_ar is null;

-- helper: insert one bilingual notification
create or replace function notify_user(
  p_user_id uuid,
  p_type text,
  p_title_ar text, p_title_he text,
  p_body_ar text, p_body_he text,
  p_data jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, title_ar, title_he, body_ar, body_he, data)
  values (p_user_id, p_type,
          p_title_ar,                 -- legacy columns keep the ar text
          coalesce(p_body_ar, ''),
          p_title_ar, p_title_he,
          coalesce(p_body_ar, ''), coalesce(p_body_he, ''),
          p_data);
$$;

-- --- rewrite the notification triggers to be bilingual ---

create or replace function notify_new_open_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare snippet text;
begin
  snippet := left(coalesce(nullif(new.title, ''), new.description), 90);
  if new.status = 'open' then
    insert into notifications (user_id, type, title, body, title_ar, title_he, body_ar, body_he, data)
    select pc.professional_id, 'offer',
      'طلب جديد بالقرب منك', snippet,
      'طلب جديد بالقرب منك', 'בקשה חדשה באזורך',
      snippet, snippet,
      jsonb_build_object('bookingId', new.id)
    from professional_categories pc
    join professionals pr on pr.id = pc.professional_id
    where pc.category_id = new.category_id
      and pr.is_available
      and (new.city_id is null or pr.city_id is null or pr.city_id = new.city_id)
      and pr.id <> new.customer_id;
  elsif new.status = 'pending' and new.professional_id is not null then
    perform notify_user(new.professional_id, 'booking_update',
      'حجز جديد', 'הזמנה חדשה', snippet, snippet,
      jsonb_build_object('bookingId', new.id));
  end if;
  return new;
end;
$$;

create or replace function notify_booking_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid; msg_ar text; msg_he text; snippet text;
begin
  if new.status = old.status then return new; end if;
  snippet := left(coalesce(nullif(new.title, ''), new.description), 90);

  if new.status in ('accepted','on_the_way','in_progress','completed','rejected') then
    target := new.customer_id;
    msg_ar := case new.status
      when 'accepted'    then 'تم قبول طلبك'
      when 'on_the_way'  then 'المهني في الطريق إليك'
      when 'in_progress' then 'بدأ العمل'
      when 'completed'   then 'اكتمل العمل — قيّم الخدمة'
      else 'عذراً، تم رفض الطلب' end;
    msg_he := case new.status
      when 'accepted'    then 'הבקשה שלך אושרה'
      when 'on_the_way'  then 'בעל המקצוע בדרך אליך'
      when 'in_progress' then 'העבודה החלה'
      when 'completed'   then 'העבודה הושלמה — דרגו את השירות'
      else 'הבקשה נדחתה' end;
  elsif new.status = 'cancelled' and new.professional_id is not null then
    target := new.professional_id;
    msg_ar := 'قام العميل بإلغاء الحجز';
    msg_he := 'הלקוח ביטל את ההזמנה';
  else
    return new;
  end if;

  perform notify_user(target, 'booking_update', msg_ar, msg_he, snippet, snippet,
                      jsonb_build_object('bookingId', new.id));
  return new;
end;
$$;

create or replace function notify_new_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare cust uuid; eta_ar text; eta_he text;
begin
  select b.customer_id into cust from bookings b where b.id = new.booking_id;
  eta_ar := '₪' || new.price::text ||
            case when new.eta_minutes is not null then ' · خلال ' || new.eta_minutes || ' د' else '' end;
  eta_he := '₪' || new.price::text ||
            case when new.eta_minutes is not null then ' · תוך ' || new.eta_minutes || ' דק׳' else '' end;
  perform notify_user(cust, 'offer', 'عرض سعر جديد', 'הצעת מחיר חדשה', eta_ar, eta_he,
                      jsonb_build_object('bookingId', new.booking_id, 'offerId', new.id));
  return new;
end;
$$;

create or replace function notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid; sender_name text; preview_ar text; preview_he text;
begin
  select case when c.customer_id = new.sender_id then c.professional_id else c.customer_id end
  into target from conversations c where c.id = new.conversation_id;
  select coalesce(nullif(p.full_name, ''), '') into sender_name from profiles p where p.id = new.sender_id;

  preview_ar := case new.type when 'text' then left(new.body, 90) when 'image' then '📷 صورة' else '📍 موقع' end;
  preview_he := case new.type when 'text' then left(new.body, 90) when 'image' then '📷 תמונה' else '📍 מיקום' end;

  perform notify_user(target, 'message',
    coalesce(nullif(sender_name, ''), 'رسالة جديدة'),
    coalesce(nullif(sender_name, ''), 'הודעה חדשה'),
    preview_ar, preview_he,
    jsonb_build_object('conversationId', new.conversation_id));
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. Legal pages (CMS) — editable from the admin without an app release.
-- The app ships built-in default text, so a page is never blank.
-- ------------------------------------------------------------
create table if not exists legal_pages (
  key text primary key check (key in ('terms', 'privacy', 'about', 'contact')),
  title_ar text not null default '',
  title_he text not null default '',
  body_ar  text not null default '',
  body_he  text not null default '',
  updated_at timestamptz not null default now()
);

alter table legal_pages enable row level security;
drop policy if exists legal_read  on legal_pages;
drop policy if exists legal_admin on legal_pages;
create policy legal_read  on legal_pages for select using (true);
create policy legal_admin on legal_pages for all    using (is_admin());

-- ------------------------------------------------------------
-- 3. Audit log — who did what, in admin.
-- Actor name/role are frozen at write time so the log survives
-- the actor's account being deleted.
-- ------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text not null default '',
  actor_role text not null default '',
  action text not null,              -- e.g. 'professional.approve'
  target_type text not null default '',
  target_id text,
  summary text not null default '',  -- human-readable line
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_id, created_at desc);

alter table audit_logs enable row level security;
drop policy if exists audit_admin_read on audit_logs;
create policy audit_admin_read on audit_logs for select using (is_admin());

create or replace function log_action(
  p_action text,
  p_target_type text default '',
  p_target_id text default null,
  p_summary text default '',
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare a_name text; a_role text;
begin
  select coalesce(full_name, ''), role::text into a_name, a_role
  from profiles where id = auth.uid();
  insert into audit_logs (actor_id, actor_name, actor_role, action, target_type, target_id, summary, metadata)
  values (auth.uid(), coalesce(a_name, ''), coalesce(a_role, ''), p_action,
          p_target_type, p_target_id, p_summary, p_metadata);
end;
$$;

-- ------------------------------------------------------------
-- 4. Review moderation — hidden reviews must not count toward the average.
-- ------------------------------------------------------------
do $$ begin
  create type review_status as enum ('published', 'hidden');
exception when duplicate_object then null; end $$;

alter table reviews add column if not exists status review_status not null default 'published';

-- recompute aggregates counting only published reviews
create or replace function review_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare pro_id uuid;
begin
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

drop trigger if exists review_effects_trigger on reviews;
create trigger review_effects_trigger
  after insert or update or delete on reviews
  for each row execute function review_effects();

drop policy if exists reviews_admin_update on reviews;
drop policy if exists reviews_admin_delete on reviews;
create policy reviews_admin_update on reviews for update using (is_admin());
create policy reviews_admin_delete on reviews for delete using (is_admin());

-- ------------------------------------------------------------
-- 5. Promoted professionals — paid placement with an expiry date,
-- so nobody stays featured because an admin forgot.
-- ------------------------------------------------------------
alter table professionals
  add column if not exists featured boolean not null default false,
  add column if not exists featured_until timestamptz,
  add column if not exists featured_sort int not null default 0;

create index if not exists professionals_featured_idx
  on professionals (featured_sort, rating_avg desc)
  where featured;

/** true only while the promotion window is still open */
create or replace function is_featured_now(p professionals) returns boolean
language sql stable as $$
  select p.featured and (p.featured_until is null or p.featured_until > now());
$$;

-- ------------------------------------------------------------
-- 6. Granular staff permissions — an admin can delegate specific
-- powers (e.g. verify pros) without handing over the whole panel.
-- ------------------------------------------------------------
alter table profiles add column if not exists permissions text[] not null default '{}';

create or replace function has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'admin' or p_permission = any(permissions))
  );
$$;

-- ------------------------------------------------------------
-- 7. Data-quality guards (cheap, catch real bugs on RTL text)
-- ------------------------------------------------------------
create or replace function is_garbled(txt text) returns boolean
language sql immutable as $$
  select txt is not null
     and (txt like '%' || chr(65533) || '%'   -- U+FFFD replacement char
          or txt ~ '^\?+$');                   -- all question marks
$$;

create or replace function guard_profile_text() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_garbled(new.full_name) then
    raise exception 'garbled full_name (encoding issue)';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_text_trigger on profiles;
create trigger guard_profile_text_trigger
  before insert or update on profiles
  for each row execute function guard_profile_text();

-- working hours must be 7 entries max, "HH:mm", from < to
create or replace function validate_working_hours(h jsonb) returns boolean
language plpgsql immutable as $$
declare k text; v jsonb;
begin
  if h is null or jsonb_typeof(h) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(h) loop
    if k !~ '^[0-6]$' then return false; end if;
    if jsonb_typeof(v) = 'null' then continue; end if;
    if (v->>'from') !~ '^[0-2][0-9]:[0-5][0-9]$' then return false; end if;
    if (v->>'to')   !~ '^[0-2][0-9]:[0-5][0-9]$' then return false; end if;
    if (v->>'from') >= (v->>'to') then return false; end if;
  end loop;
  return true;
end;
$$;

alter table professionals drop constraint if exists working_hours_valid;
alter table professionals add constraint working_hours_valid
  check (validate_working_hours(working_hours));

-- ------------------------------------------------------------
-- 8. Banner expiry (auto-hide) — one less "admin forgot" bug.
-- ------------------------------------------------------------
alter table banners add column if not exists expires_at timestamptz;
