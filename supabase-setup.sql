-- Noa Caffe QR Menü - Supabase tablosu
-- Supabase Dashboard > SQL Editor > New query > yapıştır > Run

create table if not exists menu_store (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table menu_store enable row level security;

-- Sunucu service_role ile yazacak (RLS'i bypass eder)
-- Okuma için herkese açık policy (menü herkese görünür)
create policy "menu_public_read"
  on menu_store for select
  using (true);
