-- Página independente de Gestão Geral: registos por departamento.
create table if not exists public.department_records(
 id uuid primary key default gen_random_uuid(),
 department text not null check(department in('direccao','projectos','marketing','artistas','recursos-humanos')),
 title text not null, category text, responsible_name text,
 status text not null default 'planned' check(status in('planned','in_progress','completed','cancelled')),
 start_date date, due_date date, amount numeric(14,2) not null default 0 check(amount>=0),
 notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.department_records enable row level security;
drop policy if exists admin_access on public.department_records;
create policy admin_access on public.department_records for all to authenticated
using(public.is_admin()) with check(public.is_admin());
