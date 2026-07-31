-- ============================================================
-- DalConnect — seed: categories, cities, storage buckets
-- ============================================================

insert into categories (slug, name_ar, name_he, icon, sort_order) values
  ('electrician',        'كهربائي',            'חשמלאי',            'lightning-bolt',        1),
  ('plumber',            'سبّاك',              'אינסטלטור',         'pipe-wrench',           2),
  ('ac',                 'مكيفات',             'מיזוג אוויר',       'air-conditioner',       3),
  ('painter',            'دهان',               'צבעי',              'format-paint',          4),
  ('carpenter',          'نجّار',              'נגר',               'hand-saw',              5),
  ('mechanic',           'ميكانيكي',           'מוסכניק',           'car-wrench',            6),
  ('cleaning',           'تنظيف',              'ניקיון',            'broom',                 7),
  ('gardening',          'تنسيق حدائق',        'גינון',             'flower',                8),
  ('moving',             'نقل عفش',            'הובלות',            'truck',                 9),
  ('locksmith',          'فتح أقفال',          'מנעולן',            'key-variant',          10),
  ('car-wash',           'غسيل سيارات',        'שטיפת רכב',         'car-wash',             11),
  ('appliance-repair',   'تصليح كهربائيات',    'תיקון מוצרי חשמל',  'washing-machine',      12),
  ('phone-repair',       'تصليح هواتف',        'תיקון טלפונים',     'cellphone-cog',        13),
  ('computer-repair',    'تصليح حواسيب',       'תיקון מחשבים',      'laptop',               14),
  ('roofing',            'ترميم أسطح',         'תיקון גגות',        'home-roof',            15),
  ('construction',       'أعمال بناء',         'עבודות בנייה',      'wall',                 16),
  ('tiling',             'تبليط وسيراميك',     'ריצוף וקרמיקה',     'view-grid',            17),
  ('gypsum',             'جبس وديكور',         'גבס ועיצוב',        'texture-box',          18),
  ('aluminum',           'ألمنيوم وشبابيك',    'אלומיניום וחלונות', 'window-closed-variant',19),
  ('glass',              'زجاج ومرايا',        'זגגות ומראות',      'mirror',               20),
  ('solar',              'دود شمس وطاقة شمسية','דוד שמש וסולארי',   'solar-power',          21),
  ('furniture-assembly', 'تركيب أثاث',         'הרכבת רהיטים',      'hammer-screwdriver',   22),
  ('pest-control',       'مكافحة حشرات',       'הדברה',             'bug',                  23),
  ('welding',            'حدادة ولحام',        'מסגרות וריתוך',     'torch',                24),
  ('security-cameras',   'كاميرات مراقبة',     'מצלמות אבטחה',      'cctv',                 25),
  ('internet-networks',  'شبكات وإنترنت',      'רשתות ואינטרנט',    'router-wireless',      26),
  ('tow-truck',          'سحب سيارات',         'גרר רכב',           'tow-truck',            27),
  ('sewage',             'تسليك مجاري',        'פתיחת סתימות',      'water-pump',           28),
  ('beauty',             'تجميل وعناية',       'טיפוח ויופי',       'face-woman-shimmer',   29),
  ('hairdresser',        'حلاقة وتصفيف',       'מספרה ועיצוב שיער', 'content-cut',          30),
  ('photography',        'تصوير',              'צילום',             'camera',               31),
  ('events',             'تنظيم مناسبات',      'הפקת אירועים',      'party-popper',         32);

insert into cities (name_ar, name_he, area, lat, lng) values
  ('القدس',          'ירושלים',      'ירושלים',  31.7683, 35.2137),
  ('تل أبيب',        'תל אביב',      'מרכז',     32.0853, 34.7818),
  ('حيفا',           'חיפה',         'צפון',     32.7940, 34.9896),
  ('الناصرة',        'נצרת',         'צפון',     32.6996, 35.3035),
  ('أم الفحم',       'אום אל-פחם',   'צפון',     32.5186, 35.1522),
  ('الطيبة',         'טייבה',        'מרכז',     32.2664, 35.0086),
  ('الطيرة',         'טירה',         'מרכז',     32.2333, 34.9500),
  ('قلنسوة',         'קלנסווה',      'מרכז',     32.2853, 34.9808),
  ('كفر قاسم',       'כפר קאסם',     'מרכז',     32.1136, 34.9772),
  ('باقة الغربية',   'באקה אל-גרביה','חדרה',     32.4183, 35.0424),
  ('عرابة',          'עראבה',        'צפון',     32.8511, 35.3378),
  ('سخنين',          'סח׳נין',       'צפון',     32.8664, 35.2939),
  ('شفاعمرو',        'שפרעם',        'צפון',     32.8056, 35.1697),
  ('طمرة',           'טמרה',         'צפון',     32.8531, 35.1989),
  ('عكا',            'עכו',          'צפון',     32.9281, 35.0764),
  ('يافة الناصرة',   'יפיע',         'צפון',     32.6858, 35.2764),
  ('كفر كنا',        'כפר כנא',      'צפון',     32.7469, 35.3428),
  ('رهط',            'רהט',          'דרום',     31.3928, 34.7542),
  ('بئر السبع',      'באר שבע',      'דרום',     31.2530, 34.7915),
  ('اللد',           'לוד',          'מרכז',     31.9514, 34.8953),
  ('الرملة',         'רמלה',         'מרכז',     31.9297, 34.8722),
  ('يافا',           'יפו',          'מרכז',     32.0504, 34.7522),
  ('نتانيا',         'נתניה',        'שרון',     32.3215, 34.8532),
  ('ريشون لتسيون',   'ראשון לציון',  'מרכז',     31.9730, 34.7925),
  ('بتاح تكفا',      'פתח תקווה',    'מרכז',     32.0871, 34.8878),
  ('أشدود',          'אשדוד',        'דרום',     31.8014, 34.6435),
  ('أشكلون',         'אשקלון',       'דרום',     31.6688, 34.5743),
  ('العفولة',        'עפולה',        'צפון',     32.6078, 35.2897),
  ('كرمئيل',         'כרמיאל',       'צפון',     32.9192, 35.2950),
  ('طبريا',          'טבריה',        'צפון',     32.7922, 35.5312),
  ('صفد',            'צפת',          'צפון',     32.9646, 35.4960),
  ('إيلات',          'אילת',         'דרום',     29.5577, 34.9519),
  ('هرتسليا',        'הרצליה',       'שרון',     32.1663, 34.8436),
  ('حولون',          'חולון',        'מרכז',     32.0114, 34.7748),
  ('بات يام',        'בת ים',        'מרכז',     32.0231, 34.7503),
  ('رمات غان',       'רמת גן',       'מרכז',     32.0700, 34.8235),
  ('بني براك',       'בני ברק',      'מרכז',     32.0807, 34.8338),
  ('كفار سابا',      'כפר סבא',      'שרון',     32.1858, 34.9077),
  ('رعنانا',         'רעננה',        'שרון',     32.1848, 34.8713),
  ('مودعين',         'מודיעין',      'מרכז',     31.8928, 35.0153),
  ('نهاريا',         'נהריה',        'צפון',     33.0058, 35.0989),
  ('دالية الكرمل',   'דלית אל-כרמל', 'צפון',     32.6939, 35.0464),
  ('المغار',         'מגאר',         'צפון',     32.8894, 35.4064),
  ('كفر ياسيف',      'כפר יאסיף',    'צפון',     32.9539, 35.1625),
  ('جلجولية',        'ג׳לג׳וליה',    'מרכז',     32.1547, 34.9536);

-- ---------- storage buckets ----------
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('booking-photos', 'booking-photos', true),
  ('gallery', 'gallery', true),
  ('chat-images', 'chat-images', true),
  ('id-documents', 'id-documents', false),
  ('banners', 'banners', true)
on conflict (id) do nothing;

-- public buckets: anyone reads, users write inside their own folder
create policy "public read"
  on storage.objects for select
  using (bucket_id in ('avatars', 'booking-photos', 'gallery', 'chat-images', 'banners'));

create policy "user uploads to own folder"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'booking-photos', 'gallery', 'chat-images', 'id-documents')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user manages own files"
  on storage.objects for update
  using ((storage.foldername(name))[1] = auth.uid()::text);

create policy "user deletes own files"
  on storage.objects for delete
  using ((storage.foldername(name))[1] = auth.uid()::text);

-- id-documents: only owner + admin can read
create policy "id docs private read"
  on storage.objects for select
  using (
    bucket_id = 'id-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

-- banners bucket: admin writes
create policy "admin banners write"
  on storage.objects for insert
  with check (bucket_id = 'banners' and is_admin());
