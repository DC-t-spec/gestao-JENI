-- Execute uma vez no SQL Editor do Supabase.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true); $$;

create table if not exists public.layer_entries(id uuid primary key default gen_random_uuid(),movement_date date not null,quantity integer not null check(quantity>0),notes text,created_by uuid references auth.users(id),created_at timestamptz default now());
create table if not exists public.layer_mortality(id uuid primary key default gen_random_uuid(),movement_date date not null,quantity integer not null check(quantity>0),notes text,created_by uuid references auth.users(id),created_at timestamptz default now());
create table if not exists public.egg_production(id uuid primary key default gen_random_uuid(),production_date date not null,egg_count integer not null check(egg_count>=0),notes text,created_by uuid references auth.users(id),created_at timestamptz default now());
create table if not exists public.egg_sales(id uuid primary key default gen_random_uuid(),sale_date date not null,customer_name text not null,sale_unit text not null check(sale_unit in('unit','tray')),quantity integer not null check(quantity>0),egg_quantity integer not null check(egg_quantity>0),unit_price numeric(14,2) not null,total_amount numeric(14,2) not null,payment_method text,notes text,created_by uuid references auth.users(id),created_at timestamptz default now());
create table if not exists public.company_projects(id uuid primary key default gen_random_uuid(),project_name text not null,client_name text,received_date date not null,income_amount numeric(14,2) not null check(income_amount>=0),notes text,created_by uuid references auth.users(id),created_at timestamptz default now());
create table if not exists public.partner_dues(id uuid primary key default gen_random_uuid(),partner_name text not null,due_month date not null,payment_date date not null,amount numeric(14,2) not null check(amount>=0),created_by uuid references auth.users(id),created_at timestamptz default now(),unique(partner_name,due_month));
create table if not exists public.company_tasks(id uuid primary key default gen_random_uuid(),title text not null,description text,assigned_to uuid not null constraint company_tasks_assigned_to_fkey references public.profiles(id),due_date date,priority text default 'normal' check(priority in('low','normal','high')),status text default 'pending' check(status in('pending','in_progress','completed','cancelled')),created_by uuid references auth.users(id),created_at timestamptz default now(),completed_at timestamptz);

alter table public.layer_entries enable row level security; alter table public.layer_mortality enable row level security;
alter table public.egg_production enable row level security; alter table public.egg_sales enable row level security;
alter table public.company_projects enable row level security; alter table public.partner_dues enable row level security; alter table public.company_tasks enable row level security;
do $$ declare t text; begin
 foreach t in array array['layer_entries','layer_mortality','egg_production','egg_sales'] loop
  execute format('drop policy if exists authenticated_access on public.%I',t);
  execute format('create policy authenticated_access on public.%I for all to authenticated using(true) with check(auth.uid() is not null)',t);
 end loop;
 foreach t in array array['company_projects','partner_dues','company_tasks'] loop
  execute format('drop policy if exists admin_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;

create or replace view public.egg_business_summary with(security_invoker=true) as select
coalesce((select sum(quantity) from layer_entries),0)-coalesce((select sum(quantity) from layer_mortality),0) layers_alive,
coalesce((select sum(egg_count) from egg_production),0) eggs_produced,
coalesce((select sum(egg_quantity) from egg_sales),0) eggs_sold,
coalesce((select sum(egg_count) from egg_production),0)-coalesce((select sum(egg_quantity) from egg_sales),0) eggs_in_stock,
coalesce((select sum(total_amount) from egg_sales),0)::numeric(14,2) egg_revenue;
create or replace view public.company_financial_summary with(security_invoker=true) as select
(coalesce((select sum(total_amount) from sales),0)+coalesce((select sum(total_amount) from egg_sales),0))::numeric(14,2) poultry_revenue,
coalesce((select sum(income_amount) from company_projects),0)::numeric(14,2) project_income,
coalesce((select sum(amount) from partner_dues),0)::numeric(14,2) partner_dues,
(coalesce((select sum(total_amount) from sales),0)+coalesce((select sum(total_amount) from egg_sales),0)+coalesce((select sum(income_amount) from company_projects),0)+coalesce((select sum(amount) from partner_dues),0))::numeric(14,2) total_income;
grant select on public.egg_business_summary,public.company_financial_summary to authenticated;
