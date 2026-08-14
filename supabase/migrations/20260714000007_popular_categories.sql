-- ============================================================
-- DalConnect — featured ("most requested") services
--
-- Home showed all 32 trades at once, which is a wall of choice. It now leads
-- with a short, curated set and offers everything else behind one tap.
--
-- This is data, not code: the admin can change what leads the home screen
-- without an app release.
-- ============================================================

alter table categories
  add column if not exists is_popular boolean not null default false,
  add column if not exists popular_sort int not null default 0;

comment on column categories.is_popular is
  'Shown in the "most requested" grid on the customer home screen.';
comment on column categories.popular_sort is
  'Order within the popular grid (ascending). Ignored when is_popular is false.';

create index if not exists categories_popular_idx
  on categories (popular_sort)
  where is_popular;

-- The eight most-requested trades, in the order they should appear.
update categories set is_popular = false, popular_sort = 0;
update categories set is_popular = true, popular_sort = v.ord
from (values
  ('electrician', 1),
  ('plumber',     2),
  ('ac',          3),
  ('cleaning',    4),
  ('car-wash',    5),
  ('carpenter',   6),
  ('painter',     7),
  ('gardening',   8)
) as v(slug, ord)
where categories.slug = v.slug;
