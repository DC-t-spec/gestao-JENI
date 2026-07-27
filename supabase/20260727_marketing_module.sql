-- JENI — Marketing e Comunicação
create table if not exists public.marketing_campaigns(
 id uuid primary key default gen_random_uuid(), name text not null,
 objective text not null, target_audience text, start_date date, end_date date,
 budget numeric(14,2) not null default 0 check(budget>=0),
 status text not null default 'planned' check(status in('planned','active','completed','cancelled')),
 responsible_name text, notes text, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.marketing_content(
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid references public.marketing_campaigns(id) on delete set null,
 title text not null, content_type text not null check(content_type in('post','video','story','press_release','newsletter','article','design','other')),
 channel text not null, planned_date date, published_date date,
 copy_text text, asset_url text,
 approval_status text not null default 'draft' check(approval_status in('draft','review','approved','rejected','published')),
 reach integer not null default 0 check(reach>=0), views integer not null default 0 check(views>=0),
 interactions integer not null default 0 check(interactions>=0),
 notes text, created_by uuid references auth.users(id), approved_by uuid references auth.users(id),
 approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.marketing_expenses(
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid references public.marketing_campaigns(id) on delete set null,
 expense_date date not null, category text not null, description text not null,
 amount numeric(14,2) not null check(amount>0), receipt_url text,
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.marketing_resources(
 id uuid primary key default gen_random_uuid(),
 resource_type text not null check(resource_type in('media_contact','brand_asset','supplier','other')),
 name text not null, organisation text, email text, phone text, url text,
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_content enable row level security;
alter table public.marketing_expenses enable row level security;
alter table public.marketing_resources enable row level security;
do $$ declare t text; begin
 foreach t in array array['marketing_campaigns','marketing_content','marketing_expenses','marketing_resources'] loop
  execute format('drop policy if exists admin_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;

create or replace view public.marketing_summary with(security_invoker=true) as
select
 coalesce((select count(*) from public.marketing_campaigns where status='active'),0)::integer active_campaigns,
 coalesce((select count(*) from public.marketing_content where approval_status='published'),0)::integer published_content,
 coalesce((select count(*) from public.marketing_content where approval_status in('draft','review')),0)::integer awaiting_approval,
 coalesce((select sum(budget) from public.marketing_campaigns),0)::numeric(14,2) total_budget,
 coalesce((select sum(amount) from public.marketing_expenses),0)::numeric(14,2) total_expenses,
 (coalesce((select sum(budget) from public.marketing_campaigns),0)-coalesce((select sum(amount) from public.marketing_expenses),0))::numeric(14,2) available_budget,
 coalesce((select sum(reach) from public.marketing_content),0)::bigint total_reach,
 coalesce((select sum(views) from public.marketing_content),0)::bigint total_views;
grant select on public.marketing_summary to authenticated;
