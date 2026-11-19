-- Mufloní cesta – Supabase schéma
-- Supabase → SQL Editor → vlož celé a spusť. Pak vyplň js/config.js.

create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  name text
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  cesta_id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  email text,
  team text,
  size int default 1,
  retro boolean default false,
  created_at timestamptz default now(),
  unique (cesta_id, user_id)
);

create table if not exists progress (
  cesta_id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now(),
  primary key (cesta_id, user_id)
);

create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  cesta_id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text,
  note text,
  photo_url text,
  duration_min int,
  hints int default 0,
  retro boolean default false,
  is_public boolean default true,
  created_at timestamptz default now()
);

create table if not exists ratings (
  cesta_id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text,
  stars int check (stars between 1 and 5),
  text text,
  created_at timestamptz default now(),
  primary key (cesta_id, user_id)
);

create table if not exists waitlist (
  email text not null,
  cesta_id text,
  created_at timestamptz default now(),
  unique (email, cesta_id)
);

create table if not exists admins (email text primary key);
insert into admins values ('matyas.moulis.mm@gmail.com') on conflict do nothing;

create or replace function is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

-- počty přihlášených (veřejně, bez e-mailů)
create or replace function registration_counts() returns table (cesta_id text, people bigint)
language sql stable security definer as $$
  select cesta_id, coalesce(sum(size), 0) from registrations where not retro group by cesta_id;
$$;

-- ===== RLS =====
alter table profiles enable row level security;
alter table registrations enable row level security;
alter table progress enable row level security;
alter table completions enable row level security;
alter table ratings enable row level security;
alter table waitlist enable row level security;
alter table admins enable row level security;

create policy "profil – vlastní" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "registrace – čtu svoje / admin vše" on registrations for select using (auth.uid() = user_id or is_admin());
create policy "registrace – vkládám svoje" on registrations for insert with check (auth.uid() = user_id);
create policy "registrace – měním svoje" on registrations for update using (auth.uid() = user_id);
create policy "registrace – mažu svoje" on registrations for delete using (auth.uid() = user_id or is_admin());

create policy "postup – vlastní" on progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "dokončení – veřejné čtení" on completions for select using (is_public or auth.uid() = user_id or is_admin());
create policy "dokončení – vkládám svoje" on completions for insert with check (auth.uid() = user_id);
create policy "dokončení – mažu svoje / admin" on completions for delete using (auth.uid() = user_id or is_admin());

create policy "hodnocení – veřejné čtení" on ratings for select using (true);
create policy "hodnocení – vlastní zápis" on ratings for insert with check (auth.uid() = user_id);
create policy "hodnocení – vlastní úprava" on ratings for update using (auth.uid() = user_id);

create policy "odběr – kdokoliv se zapíše" on waitlist for insert with check (true);
create policy "odběr – čte jen admin" on waitlist for select using (is_admin());

-- ===== Úložiště fotek =====
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict do nothing;
create policy "fotky – veřejné čtení" on storage.objects for select using (bucket_id = 'photos');
create policy "fotky – nahrávám do své složky" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotky – přepis své" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
