-- JENI — Módulo completo de Projectos e Candidaturas
create table if not exists public.project_records(
 id uuid primary key default gen_random_uuid(),
 record_type text not null check(record_type in('execution','partnership','application')),
 title text not null, funder text, country text, responsible_name text not null,
 partners_text text, beneficiaries text,
 start_date date, end_date date, deadline date,
 total_budget numeric(14,2) not null default 0 check(total_budget>=0),
 requested_amount numeric(14,2) not null default 0 check(requested_amount>=0),
 approved_amount numeric(14,2) not null default 0 check(approved_amount>=0),
 status text not null default 'identified' check(status in('identified','preparing','submitted','approved','in_progress','completed','suspended','rejected','cancelled')),
 next_step text not null, next_step_date date,
 document_url text, report_url text, notes text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.project_expenses(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.project_records(id) on delete cascade,
 expense_date date not null, category text not null, description text not null,
 amount numeric(14,2) not null check(amount>0), payment_method text,
 receipt_url text, notes text, created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

create table if not exists public.project_milestones(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.project_records(id) on delete cascade,
 title text not null, due_date date, responsible_name text,
 status text not null default 'pending' check(status in('pending','in_progress','completed','delayed','cancelled')),
 document_url text, notes text, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), completed_at timestamptz
);

alter table public.project_records enable row level security;
alter table public.project_expenses enable row level security;
alter table public.project_milestones enable row level security;
do $$ declare t text; begin
 foreach t in array array['project_records','project_expenses','project_milestones'] loop
  execute format('drop policy if exists admin_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;

create or replace view public.projects_summary with(security_invoker=true) as
select
 coalesce((select count(*) from public.project_records where record_type='execution' and status in('approved','in_progress')),0)::integer active_projects,
 coalesce((select count(*) from public.project_records where record_type='partnership' and status not in('completed','cancelled','rejected')),0)::integer active_partnerships,
 coalesce((select count(*) from public.project_records where record_type='application' and status in('identified','preparing','submitted')),0)::integer active_applications,
 coalesce((select count(*) from public.project_records where deadline between current_date and current_date+interval '30 days'),0)::integer deadlines_30_days,
 coalesce((select sum(total_budget) from public.project_records),0)::numeric(14,2) total_budget,
 coalesce((select sum(approved_amount) from public.project_records),0)::numeric(14,2) approved_funding,
 coalesce((select sum(amount) from public.project_expenses),0)::numeric(14,2) total_expenses,
 (coalesce((select sum(approved_amount) from public.project_records),0)-coalesce((select sum(amount) from public.project_expenses),0))::numeric(14,2) available_balance;
grant select on public.projects_summary to authenticated;
