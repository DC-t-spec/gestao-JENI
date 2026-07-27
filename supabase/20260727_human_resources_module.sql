-- JENI — Recursos Humanos
create table if not exists public.hr_employees(
 id uuid primary key default gen_random_uuid(), full_name text not null, employee_number text unique,
 birth_date date, gender text, phone text, email text, address text, emergency_contact text,
 department text not null, job_title text not null, hire_date date not null,
 employment_type text not null default 'employee', base_salary numeric(14,2) not null default 0 check(base_salary>=0),
 nuit text, bank_details text, status text not null default 'active' check(status in('active','inactive','on_leave','terminated')),
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.hr_contracts(
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
 contract_type text not null, start_date date not null, end_date date, salary numeric(14,2) not null default 0 check(salary>=0),
 document_url text, status text not null default 'active' check(status in('active','pending','ended','cancelled')),
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.hr_absences(
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
 absence_type text not null, start_date date not null, end_date date not null check(end_date>=start_date),
 status text not null default 'requested' check(status in('requested','approved','rejected','completed')),
 document_url text, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.hr_reviews(
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
 review_date date not null, reviewer_name text not null, score numeric(5,2) check(score between 0 and 100),
 next_review_date date, strengths text, improvements text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.hr_trainings(
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
 title text not null, provider text, training_date date, cost numeric(14,2) not null default 0 check(cost>=0),
 status text not null default 'planned' check(status in('planned','in_progress','completed','cancelled')),
 certificate_url text, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.hr_movements(
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
 movement_type text not null check(movement_type in('admission','renewal','promotion','job_change','warning','disciplinary','termination')),
 movement_date date not null, previous_position text, new_position text, reason text not null, document_url text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.hr_documents(
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.hr_employees(id) on delete cascade,
 document_type text not null, title text not null, expiry_date date, document_url text not null, notes text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.hr_employees enable row level security;
alter table public.hr_contracts enable row level security;
alter table public.hr_absences enable row level security;
alter table public.hr_reviews enable row level security;
alter table public.hr_trainings enable row level security;
alter table public.hr_movements enable row level security;
alter table public.hr_documents enable row level security;
do $$ declare t text; begin
 foreach t in array array['hr_employees','hr_contracts','hr_absences','hr_reviews','hr_trainings','hr_movements','hr_documents'] loop
  execute format('drop policy if exists admin_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;
create or replace view public.hr_summary with(security_invoker=true) as
select
 coalesce((select count(*) from public.hr_employees where status='active'),0)::integer active_employees,
 coalesce((select count(*) from public.hr_contracts where status='active' and end_date between current_date and current_date+60),0)::integer expiring_contracts,
 coalesce((select count(*) from public.hr_absences where status='approved' and current_date between start_date and end_date),0)::integer current_absences,
 coalesce((select count(*) from public.hr_employees where status='active' and extract(month from birth_date)=extract(month from current_date)),0)::integer birthdays_month,
 coalesce((select count(*) from public.hr_employees e where e.status='active' and not exists(select 1 from public.hr_reviews r where r.employee_id=e.id and r.review_date>=current_date-365)),0)::integer pending_reviews,
 coalesce((select count(*) from public.hr_trainings where status in('planned','in_progress')),0)::integer pending_trainings;
grant select on public.hr_summary to authenticated;
