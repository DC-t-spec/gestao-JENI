-- JENI — Tarefas e Agenda
alter table public.company_tasks add column if not exists department text;
alter table public.company_tasks add column if not exists project_record_id uuid references public.project_records(id) on delete set null;
alter table public.company_tasks add column if not exists artist_id uuid references public.artists(id) on delete set null;
alter table public.company_tasks add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete set null;
alter table public.company_tasks add column if not exists parent_task_id uuid references public.company_tasks(id) on delete cascade;
alter table public.company_tasks add column if not exists recurrence text default 'none';
alter table public.company_tasks add column if not exists recurrence_end date;
alter table public.company_tasks add column if not exists document_url text;

create table if not exists public.task_comments(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.company_tasks(id) on delete cascade,
 comment_text text not null, created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

create table if not exists public.agenda_events(
 id uuid primary key default gen_random_uuid(), title text not null,
 event_type text not null check(event_type in('meeting','event','deadline','reminder','other')),
 event_date date not null, start_time time, end_time time, location text,
 responsible_id uuid references public.profiles(id) on delete set null,
 department text, project_record_id uuid references public.project_records(id) on delete set null,
 artist_id uuid references public.artists(id) on delete set null,
 campaign_id uuid references public.marketing_campaigns(id) on delete set null,
 recurrence text not null default 'none', recurrence_end date,
 document_url text, notes text,
 status text not null default 'scheduled' check(status in('scheduled','completed','cancelled')),
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.task_comments enable row level security;
alter table public.agenda_events enable row level security;
do $$ declare t text; begin
 foreach t in array array['task_comments','agenda_events'] loop
  execute format('drop policy if exists admin_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;

create or replace view public.tasks_agenda_summary with(security_invoker=true) as
select
 coalesce((select count(*) from public.company_tasks where status not in('completed','cancelled') and due_date=current_date),0)::integer tasks_today,
 coalesce((select count(*) from public.company_tasks where status not in('completed','cancelled') and due_date<current_date),0)::integer overdue_tasks,
 coalesce((select count(*) from public.company_tasks where status='completed'),0)::integer completed_tasks,
 coalesce((select count(*) from public.company_tasks where status not in('completed','cancelled')),0)::integer open_tasks,
 coalesce((select count(*) from public.agenda_events where status='scheduled' and event_date=current_date),0)::integer events_today,
 coalesce((select count(*) from public.agenda_events where status='scheduled' and event_date between current_date and current_date+interval '7 days'),0)::integer events_week;
grant select on public.tasks_agenda_summary to authenticated;
