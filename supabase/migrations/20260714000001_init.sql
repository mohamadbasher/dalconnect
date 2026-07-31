-- ============================================================
-- DalConnect — initial schema
-- Service marketplace: customers <-> professionals, Israel (ar/he)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- enums ----------
create type user_role as enum ('customer', 'professional', 'admin');
create type verification_status as enum ('none', 'pending', 'approved', 'rejected');
create type booking_type as enum ('direct', 'open');
create type booking_status as enum (
  'open',        -- open request, collecting offers
  'pending',     -- direct booking, waiting for pro to accept
  'accepted',    -- pro accepted / offer chosen
  'on_the_way',  -- pro heading to customer
  'in_progress', -- work started
  'completed',   -- work finished
  'cancelled',   -- cancelled by customer
  'rejected',    -- rejected by pro / expired
  'rated'        -- completed + review left
);
create type offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
create type message_type as enum ('text', 'image', 'location');
create type report_status as enum ('open', 'in_review', 'resolved', 'dismissed');

-- ---------- reference data ----------
create table cities (
  id serial primary key,
  name_ar text not null,
  name_he text not null,
  area text,
  lat double precision,
  lng double precision,
  is_active boolean not null default true
);

create table categories (
  id serial primary key,
  slug text not null unique,
  name_ar text not null,
  name_he text not null,
  icon text not null default 'tools', -- MaterialCommunityIcons name
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ---------- users ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  full_name text not null default '',
  phone text not null default '',
  avatar_url text,
  city_id int references cities(id),
  lang text not null default 'ar' check (lang in ('ar', 'he')),
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table professionals (
  id uuid primary key references profiles(id) on delete cascade,
  business_name text not null default '',
  bio text not null default '',
  city_id int references cities(id),
  lat double precision,
  lng double precision,
  is_available boolean not null default true,
  verification_status verification_status not null default 'none',
  id_document_url text,
  working_hours jsonb not null default '{}'::jsonb, -- {"0":{"from":"08:00","to":"18:00"},...} 0=Sunday
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  jobs_completed int not null default 0,
  created_at timestamptz not null default now()
);

create table professional_categories (
  professional_id uuid not null references professionals(id) on delete cascade,
  category_id int not null references categories(id) on delete cascade,
  primary key (professional_id, category_id)
);

create table gallery_items (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references professionals(id) on delete cascade,
  image_url text not null,
  caption text not null default '',
  created_at timestamptz not null default now()
);

create table favorites (
  customer_id uuid not null references profiles(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, professional_id)
);

-- ---------- bookings & offers ----------
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  type booking_type not null,
  status booking_status not null,
  customer_id uuid not null references profiles(id) on delete cascade,
  professional_id uuid references professionals(id) on delete set null, -- null while 'open'
  category_id int not null references categories(id),
  title text not null default '',
  description text not null default '',
  photos text[] not null default '{}',
  city_id int references cities(id),
  address text not null default '',
  lat double precision,
  lng double precision,
  scheduled_at timestamptz,          -- preferred date/time (null = ASAP)
  price numeric(10,2),               -- agreed price
  commission numeric(10,2),          -- platform commission at completion
  cancel_reason text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);
create index bookings_customer_idx on bookings (customer_id, created_at desc);
create index bookings_professional_idx on bookings (professional_id, created_at desc);
create index bookings_open_idx on bookings (category_id, city_id) where status = 'open';

create table offers (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references bookings(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  price numeric(10,2) not null,
  eta_minutes int,
  message text not null default '',
  status offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (booking_id, professional_id)
);
create index offers_booking_idx on offers (booking_id);
create index offers_professional_idx on offers (professional_id, created_at desc);

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);
create index reviews_professional_idx on reviews (professional_id, created_at desc);

-- earnings ledger, written when a booking completes
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references professionals(id) on delete cascade,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  amount numeric(10,2) not null,      -- gross price
  commission numeric(10,2) not null,  -- platform cut
  net numeric(10,2) not null,         -- amount - commission
  created_at timestamptz not null default now()
);
create index transactions_professional_idx on transactions (professional_id, created_at desc);

-- ---------- chat ----------
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references profiles(id) on delete cascade,
  professional_id uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  unique (customer_id, professional_id)
);
create index conversations_customer_idx on conversations (customer_id, last_message_at desc);
create index conversations_professional_idx on conversations (professional_id, last_message_at desc);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  type message_type not null default 'text',
  body text not null default '',
  image_url text,
  lat double precision,
  lng double precision,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at desc);

-- ---------- notifications & push ----------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,                 -- booking_update | offer | message | system | promo
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb, -- {bookingId, conversationId, ...}
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

create table push_tokens (
  token text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null default 'unknown',
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on push_tokens (user_id);

-- ---------- moderation / admin ----------
create table reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_user_id uuid references profiles(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  reason text not null,
  details text not null default '',
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

create table banners (
  id uuid primary key default uuid_generate_v4(),
  image_url text not null,
  title text not null default '',
  link text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null
);
insert into app_settings (key, value) values ('commission_rate', '0.10');

-- ============================================================
-- helpers
-- ============================================================
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function commission_rate() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((value)::text::numeric, 0.10) from app_settings where key = 'commission_rate';
$$;

-- auto-create profile on signup (metadata from the app)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone, lang)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'lang', 'ar')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- block self-service role/ban escalation
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
  return new;
end;
$$;
create trigger protect_profile_fields_trigger
  before update on profiles
  for each row execute function protect_profile_fields();

-- atomic customer -> professional upgrade
create or replace function become_professional(
  p_business_name text,
  p_bio text default '',
  p_city_id int default null,
  p_category_ids int[] default '{}',
  p_id_document_url text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into professionals (id, business_name, bio, city_id, id_document_url, verification_status)
  values (uid, p_business_name, p_bio, p_city_id, p_id_document_url,
          case when p_id_document_url is null then 'none'::verification_status else 'pending'::verification_status end)
  on conflict (id) do nothing;
  update profiles set role = 'professional' where id = uid and role = 'customer';
  insert into professional_categories (professional_id, category_id)
  select uid, unnest(p_category_ids)
  on conflict do nothing;
end;
$$;

-- atomic offer acceptance: assign pro, set price, close other offers
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
  update offers set status = 'rejected' where booking_id = b.id and id <> o.id and status = 'pending';
  update bookings set
    status = 'accepted',
    professional_id = o.professional_id,
    price = o.price,
    accepted_at = now()
  where id = b.id;
end;
$$;

-- booking completion: compute commission + write ledger row
create or replace function complete_booking_effects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := now();
    if new.price is not null and new.professional_id is not null then
      new.commission := round(new.price * commission_rate(), 2);
      insert into transactions (professional_id, booking_id, amount, commission, net)
      values (new.professional_id, new.id, new.price, new.commission, new.price - new.commission)
      on conflict (booking_id) do nothing;
      update professionals set jobs_completed = jobs_completed + 1 where id = new.professional_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger booking_completion_trigger
  before update on bookings
  for each row execute function complete_booking_effects();

-- review -> keep professional rating in sync + mark booking rated
create or replace function review_effects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update professionals p set
    rating_avg = sub.avg, rating_count = sub.cnt
  from (select avg(rating)::numeric(3,2) as avg, count(*) as cnt
        from reviews where professional_id = new.professional_id) sub
  where p.id = new.professional_id;
  update bookings set status = 'rated' where id = new.booking_id and status = 'completed';
  return new;
end;
$$;
create trigger review_effects_trigger
  after insert on reviews
  for each row execute function review_effects();

-- chat: bump conversation preview
create or replace function message_effects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversations set
    last_message_at = new.created_at,
    last_message_preview = case new.type
      when 'text' then left(new.body, 80)
      when 'image' then '📷'
      else '📍' end
  where id = new.conversation_id;
  return new;
end;
$$;
create trigger message_effects_trigger
  after insert on messages
  for each row execute function message_effects();

-- ============================================================
-- notification fan-out (rows in `notifications`; a DB webhook on
-- this table calls the send-push edge function)
-- ============================================================

-- new open request -> notify matching available pros in same city (or all cities if none set)
create or replace function notify_new_open_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'open' then
    insert into notifications (user_id, type, title, body, data)
    select pc.professional_id, 'offer',
      'طلب جديد بالقرب منك · בקשה חדשה באזורך',
      left(coalesce(nullif(new.title, ''), new.description), 90),
      jsonb_build_object('bookingId', new.id)
    from professional_categories pc
    join professionals pr on pr.id = pc.professional_id
    where pc.category_id = new.category_id
      and pr.is_available
      and (new.city_id is null or pr.city_id is null or pr.city_id = new.city_id)
      and pr.id <> new.customer_id;
  elsif new.status = 'pending' and new.professional_id is not null then
    insert into notifications (user_id, type, title, body, data)
    values (new.professional_id, 'booking_update',
      'حجز جديد · הזמנה חדשה',
      left(coalesce(nullif(new.title, ''), new.description), 90),
      jsonb_build_object('bookingId', new.id));
  end if;
  return new;
end;
$$;
create trigger notify_new_booking_trigger
  after insert on bookings
  for each row execute function notify_new_open_booking();

-- booking status changes -> notify the other side
create or replace function notify_booking_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid; msg text;
begin
  if new.status = old.status then return new; end if;
  if new.status in ('accepted','on_the_way','in_progress','completed','rejected') then
    target := new.customer_id;
    msg := case new.status
      when 'accepted' then 'تم قبول طلبك · הבקשה שלך אושרה'
      when 'on_the_way' then 'المهني في الطريق إليك · בעל המקצוע בדרך אליך'
      when 'in_progress' then 'بدأ العمل · העבודה החלה'
      when 'completed' then 'اكتمل العمل — قيّم الخدمة · העבודה הושלמה — דרגו את השירות'
      else 'عذراً، تم رفض الطلب · הבקשה נדחתה' end;
  elsif new.status = 'cancelled' and new.professional_id is not null then
    target := new.professional_id;
    msg := 'قام العميل بإلغاء الحجز · הלקוח ביטל את ההזמנה';
  else
    return new;
  end if;
  insert into notifications (user_id, type, title, body, data)
  values (target, 'booking_update', msg, left(coalesce(nullif(new.title,''), new.description), 90),
          jsonb_build_object('bookingId', new.id));
  return new;
end;
$$;
create trigger notify_booking_status_trigger
  after update on bookings
  for each row execute function notify_booking_status();

-- new offer -> notify customer
create or replace function notify_new_offer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, type, title, body, data)
  select b.customer_id, 'offer',
    'عرض سعر جديد · הצעת מחיר חדשה',
    '₪' || new.price::text || case when new.eta_minutes is not null then ' · ' || new.eta_minutes || ' د · דק׳' else '' end,
    jsonb_build_object('bookingId', new.booking_id, 'offerId', new.id)
  from bookings b where b.id = new.booking_id;
  return new;
end;
$$;
create trigger notify_new_offer_trigger
  after insert on offers
  for each row execute function notify_new_offer();

-- new message -> notify recipient
create or replace function notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select case when c.customer_id = new.sender_id then c.professional_id else c.customer_id end
  into target from conversations c where c.id = new.conversation_id;
  insert into notifications (user_id, type, title, body, data)
  select target, 'message',
    coalesce(nullif(p.full_name, ''), 'رسالة جديدة · הודעה חדשה'),
    case new.type when 'text' then left(new.body, 90) when 'image' then '📷' else '📍' end,
    jsonb_build_object('conversationId', new.conversation_id)
  from profiles p where p.id = new.sender_id;
  return new;
end;
$$;
create trigger notify_new_message_trigger
  after insert on messages
  for each row execute function notify_new_message();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table professionals enable row level security;
alter table professional_categories enable row level security;
alter table gallery_items enable row level security;
alter table favorites enable row level security;
alter table bookings enable row level security;
alter table offers enable row level security;
alter table reviews enable row level security;
alter table transactions enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table push_tokens enable row level security;
alter table reports enable row level security;
alter table banners enable row level security;
alter table app_settings enable row level security;
alter table cities enable row level security;
alter table categories enable row level security;

-- reference data: readable by all, writable by admin
create policy cities_read on cities for select using (true);
create policy cities_admin on cities for all using (is_admin());
create policy categories_read on categories for select using (true);
create policy categories_admin on categories for all using (is_admin());
create policy banners_read on banners for select using (is_active or is_admin());
create policy banners_admin on banners for all using (is_admin());
create policy settings_read on app_settings for select using (true);
create policy settings_admin on app_settings for all using (is_admin());

-- profiles: public basic read (names/avatars shown around the app), self update
create policy profiles_read on profiles for select using (true);
create policy profiles_update_self on profiles for update using (id = auth.uid() or is_admin());

-- professionals: public read (directory), self manage
create policy professionals_read on professionals for select using (true);
create policy professionals_insert_self on professionals for insert with check (id = auth.uid() or is_admin());
create policy professionals_update_self on professionals for update using (id = auth.uid() or is_admin());
create policy pro_categories_read on professional_categories for select using (true);
create policy pro_categories_self on professional_categories for all using (professional_id = auth.uid() or is_admin());
create policy gallery_read on gallery_items for select using (true);
create policy gallery_self on gallery_items for all using (professional_id = auth.uid() or is_admin());

-- favorites: private to owner
create policy favorites_self on favorites for all using (customer_id = auth.uid());

-- bookings: parties + admin; open requests visible to available pros in that category
create policy bookings_read on bookings for select using (
  customer_id = auth.uid()
  or professional_id = auth.uid()
  or is_admin()
  or (status = 'open' and exists (
        select 1 from professional_categories pc
        where pc.professional_id = auth.uid() and pc.category_id = bookings.category_id))
);
create policy bookings_insert on bookings for insert with check (customer_id = auth.uid());
create policy bookings_update_parties on bookings for update using (
  customer_id = auth.uid() or professional_id = auth.uid() or is_admin()
);

-- offers: pro writes own; customer of the booking + the pro read
create policy offers_read on offers for select using (
  professional_id = auth.uid()
  or is_admin()
  or exists (select 1 from bookings b where b.id = offers.booking_id and b.customer_id = auth.uid())
);
create policy offers_insert on offers for insert with check (professional_id = auth.uid());
create policy offers_update_own on offers for update using (professional_id = auth.uid() or is_admin());

-- reviews: public read, customer of the completed booking writes
create policy reviews_read on reviews for select using (true);
create policy reviews_insert on reviews for insert with check (
  customer_id = auth.uid()
  and exists (select 1 from bookings b where b.id = booking_id
              and b.customer_id = auth.uid() and b.status = 'completed')
);

-- transactions: pro sees own, admin all
create policy transactions_read on transactions for select using (professional_id = auth.uid() or is_admin());

-- chat: parties only
create policy conversations_parties on conversations for select using (
  customer_id = auth.uid() or professional_id = auth.uid() or is_admin()
);
create policy conversations_insert on conversations for insert with check (
  customer_id = auth.uid() or professional_id = auth.uid()
);
create policy conversations_update on conversations for update using (
  customer_id = auth.uid() or professional_id = auth.uid()
);
create policy messages_read on messages for select using (
  exists (select 1 from conversations c where c.id = conversation_id
          and (c.customer_id = auth.uid() or c.professional_id = auth.uid()))
  or is_admin()
);
create policy messages_insert on messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from conversations c where c.id = conversation_id
              and (c.customer_id = auth.uid() or c.professional_id = auth.uid()))
);
create policy messages_update_read_flag on messages for update using (
  exists (select 1 from conversations c where c.id = conversation_id
          and (c.customer_id = auth.uid() or c.professional_id = auth.uid()))
);

-- notifications: own only
create policy notifications_self on notifications for select using (user_id = auth.uid());
create policy notifications_update_self on notifications for update using (user_id = auth.uid());

-- push tokens: own only
create policy push_tokens_self on push_tokens for all using (user_id = auth.uid());

-- reports: reporter writes, admin manages
create policy reports_insert on reports for insert with check (reporter_id = auth.uid());
create policy reports_read on reports for select using (reporter_id = auth.uid() or is_admin());
create policy reports_admin_update on reports for update using (is_admin());

-- ============================================================
-- realtime
-- ============================================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table offers;
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table conversations;
