-- Gestão Geral JENI — Fase 2
create table if not exists public.partners(
 id uuid primary key default gen_random_uuid(), full_name text not null unique,
 email text, phone text, monthly_due numeric(14,2) not null default 100 check(monthly_due>=0),
 joined_at date, is_active boolean not null default true, notes text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.institutional_transactions(
 id uuid primary key default gen_random_uuid(), transaction_date date not null,
 direction text not null check(direction in('income','expense')),
 category text not null, department text not null, description text not null,
 amount numeric(14,2) not null check(amount>0), payment_method text,
 project_id uuid references public.company_projects(id) on delete set null,
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.funding_opportunities(
 id uuid primary key default gen_random_uuid(), title text not null, funder text,
 country text, requested_amount numeric(14,2) not null default 0 check(requested_amount>=0),
 deadline date, responsible_name text, partners_text text,
 status text not null default 'identified' check(status in('identified','preparing','submitted','approved','rejected')),
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.partners enable row level security;
alter table public.institutional_transactions enable row level security;
alter table public.funding_opportunities enable row level security;
do $$ declare t text; begin
 foreach t in array array['partners','institutional_transactions','funding_opportunities'] loop
  execute format('drop policy if exists admin_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;

create or replace view public.management_dashboard with(security_invoker=true) as
select
 coalesce((select sum(amount) from public.institutional_transactions where direction='income'),0)::numeric(14,2) institutional_income,
 coalesce((select sum(amount) from public.institutional_transactions where direction='expense'),0)::numeric(14,2) institutional_expenses,
 (coalesce((select sum(amount) from public.institutional_transactions where direction='income'),0)-
  coalesce((select sum(amount) from public.institutional_transactions where direction='expense'),0))::numeric(14,2) institutional_balance,
 coalesce((select sum(total_amount) from public.sales),0)::numeric(14,2) chicken_revenue,
 coalesce((select sum(total_amount) from public.egg_sales),0)::numeric(14,2) egg_revenue,
 coalesce((select sum(income_amount) from public.company_projects),0)::numeric(14,2) project_income,
 coalesce((select sum(amount) from public.partner_dues),0)::numeric(14,2) partner_dues_income,
 coalesce((select count(*) from public.funding_opportunities where status in('identified','preparing','submitted')),0)::integer active_applications,
 coalesce((select count(*) from public.company_tasks where status not in('completed','cancelled')),0)::integer pending_tasks,
 coalesce((select count(*) from public.company_tasks where status not in('completed','cancelled') and due_date<current_date),0)::integer overdue_tasks,
 coalesce((select count(*) from public.partners where is_active=true),0)::integer active_partners;
grant select on public.management_dashboard to authenticated;
