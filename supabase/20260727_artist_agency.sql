-- JENI — Agência de Artistas
create table if not exists public.artists(
 id uuid primary key default gen_random_uuid(), artistic_name text not null,
 legal_name text, email text, phone text, biography text, genres text,
 distributor text, spotify_url text, youtube_url text, instagram_url text,
 status text not null default 'active' check(status in('active','inactive','prospect')),
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.artist_contracts(
 id uuid primary key default gen_random_uuid(), artist_id uuid not null references public.artists(id) on delete cascade,
 contract_type text not null default 'management', start_date date not null, end_date date,
 commission_notes text, document_url text,
 status text not null default 'active' check(status in('draft','active','expired','terminated')),
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.artist_activities(
 id uuid primary key default gen_random_uuid(), artist_id uuid not null references public.artists(id) on delete cascade,
 activity_type text not null check(activity_type in('concert','release','distribution','opportunity','application','other')),
 title text not null, activity_date date, organisation text, location text,
 gross_amount numeric(14,2) not null default 0 check(gross_amount>=0),
 jeni_income numeric(14,2) not null default 0 check(jeni_income>=0),
 artist_amount numeric(14,2) not null default 0 check(artist_amount>=0),
 payment_status text not null default 'pending' check(payment_status in('pending','partial','paid','cancelled')),
 status text not null default 'planned' check(status in('planned','confirmed','completed','cancelled')),
 platform_links text, notes text, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.artists enable row level security;
alter table public.artist_contracts enable row level security;
alter table public.artist_activities enable row level security;
do $$ declare t text; begin
 foreach t in array array['artists','artist_contracts','artist_activities'] loop
  execute format('drop policy if exists admin_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;

create or replace view public.artist_agency_summary with(security_invoker=true) as
select
 coalesce((select count(*) from public.artists where status='active'),0)::integer active_artists,
 coalesce((select count(*) from public.artist_contracts where status='active'),0)::integer active_contracts,
 coalesce((select count(*) from public.artist_activities where status in('planned','confirmed')),0)::integer upcoming_activities,
 coalesce((select sum(gross_amount) from public.artist_activities),0)::numeric(14,2) gross_income,
 coalesce((select sum(jeni_income) from public.artist_activities),0)::numeric(14,2) jeni_income,
 coalesce((select sum(artist_amount) from public.artist_activities),0)::numeric(14,2) artist_income,
 coalesce((select sum(gross_amount) from public.artist_activities where payment_status!='paid'),0)::numeric(14,2) pending_payments;
grant select on public.artist_agency_summary to authenticated;
