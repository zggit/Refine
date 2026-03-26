-- ============================================================
-- 1. categories
-- ============================================================
create table if not exists public.categories (
  id      bigint generated always as identity primary key,
  title   text not null
);

alter table public.categories enable row level security;

create policy "allow all for anon" on public.categories
  for all to anon, authenticated using (true) with check (true);

-- ============================================================
-- 2. blog_posts  (references categories)
-- ============================================================
create table if not exists public.blog_posts (
  id          bigint generated always as identity primary key,
  title       text        not null,
  content     text        not null,
  category_id bigint      references public.categories (id) on delete set null,
  status      text        not null default 'draft'
                          check (status in ('draft', 'published', 'rejected')),
  created_at  timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

create policy "allow all for anon" on public.blog_posts
  for all to anon, authenticated using (true) with check (true);

-- ============================================================
-- 3. ebay_orders
-- ============================================================
create table if not exists public.ebay_orders (
  id              bigint         generated always as identity primary key,
  order_id        text           not null unique,
  buyer_username  text           not null,
  item_title      text           not null,
  total_price     numeric(10, 2) not null,
  status          text           not null default 'pending'
                                 check (status in ('pending', 'shipped', 'delivered', 'cancelled')),
  created_at      timestamptz    not null default now()
);

alter table public.ebay_orders enable row level security;

create policy "allow all for anon" on public.ebay_orders
  for all to anon, authenticated using (true) with check (true);

-- ============================================================
-- Seed: categories
-- ============================================================
insert into public.categories (title) values
  ('Technology'),
  ('Travel'),
  ('Food & Cooking'),
  ('Science'),
  ('Sports');

-- ============================================================
-- Seed: blog_posts
-- ============================================================
insert into public.blog_posts (title, content, category_id, status, created_at) values
  (
    'Getting Started with Next.js 15',
    '## Introduction\n\nNext.js 15 brings many exciting improvements including better performance, improved dev experience, and full App Router stability.\n\n## Key Features\n\n- Turbopack by default\n- Improved caching\n- React 19 support\n\nGive it a try today!',
    1, 'published', now() - interval '10 days'
  ),
  (
    'Top 5 Hidden Gems in Southeast Asia',
    '## Explore Beyond the Tourist Trail\n\nSoutheast Asia is full of breathtaking places that most travellers never visit.\n\n1. Kampot, Cambodia\n2. Pai, Thailand\n3. Moni, Indonesia\n4. El Nido alternative beaches\n5. Phong Nha caves, Vietnam',
    2, 'published', now() - interval '7 days'
  ),
  (
    'Mastering Homemade Ramen',
    '## The Perfect Bowl\n\nGreat ramen starts with the broth. Simmer pork bones for 12 hours to build depth.\n\n### Toppings\n- Chashu pork\n- Soft-boiled marinated egg\n- Bamboo shoots\n- Nori\n\nPatience is the secret ingredient.',
    3, 'published', now() - interval '4 days'
  ),
  (
    'Black Holes Explained Simply',
    '## What Is a Black Hole?\n\nA black hole is a region of spacetime where gravity is so strong that nothing — not even light — can escape.\n\n## Formation\n\nMost stellar black holes form when a massive star collapses at the end of its life.\n\nFascinating stuff!',
    4, 'draft', now() - interval '2 days'
  ),
  (
    'The Rise of Women''s Football',
    '## A Global Revolution\n\nWomen''s football viewership hit record highs at the 2023 World Cup.\n\n## Why It Matters\n\n- Increased investment in clubs\n- Better youth academies\n- Growing media coverage\n\nThe future is bright for the beautiful game.',
    5, 'rejected', now() - interval '1 day'
  );

-- ============================================================
-- Seed: ebay_orders
-- ============================================================
insert into public.ebay_orders (order_id, buyer_username, item_title, total_price, status, created_at) values
  ('EB-2025-00001', 'gadget_hunter99',  'Apple AirPods Pro (2nd Gen)',          189.99, 'delivered',  now() - interval '20 days'),
  ('EB-2025-00002', 'vintagefinds',     'Vintage Leica M3 Film Camera',        749.00, 'shipped',    now() - interval '10 days'),
  ('EB-2025-00003', 'sneakerhead_mike', 'Nike Air Jordan 1 Retro High OG',     210.50, 'pending',    now() - interval '3 days'),
  ('EB-2025-00004', 'bookworm_alice',   'Rare First Edition – Dune (1965)',     320.00, 'delivered',  now() - interval '30 days'),
  ('EB-2025-00005', 'tech_deals_uk',    'DJI Mini 4 Pro Drone Fly More Combo', 899.95, 'cancelled',  now() - interval '5 days');
