-- JENI — Financeiro completo
create table if not exists public.finance_accounts(
 id uuid primary key default gen_random_uuid(), account_name text not null, account_type text not null,
 institution_name text, account_reference text, opening_balance numeric(14,2) not null default 0,
 currency text not null default 'MZN', is_active boolean not null default true,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.institutional_transactions add column if not exists account_id uuid references public.finance_accounts(id) on delete set null;
alter table public.institutional_transactions add column if not exists approval_status text default 'approved';
alter table public.institutional_transactions add column if not exists approved_by uuid references auth.users(id);
alter table public.institutional_transactions add column if not exists approved_at timestamptz;
alter table public.institutional_transactions add column if not exists recurrence text default 'none';
alter table public.institutional_transactions add column if not exists document_url text;
create table if not exists public.finance_obligations(
 id uuid primary key default gen_random_uuid(), obligation_type text not null check(obligation_type in('payable','receivable')),
 entity_name text not null, description text not null, total_amount numeric(14,2) not null check(total_amount>0),
 paid_amount numeric(14,2) not null default 0 check(paid_amount>=0), issue_date date not null, due_date date not null,
 department text, project_id uuid references public.company_projects(id) on delete set null,
 status text not null default 'pending' check(status in('pending','partial','paid','overdue','cancelled')),
 document_url text, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.finance_payments(
 id uuid primary key default gen_random_uuid(), obligation_id uuid not null references public.finance_obligations(id) on delete cascade,
 payment_date date not null, amount numeric(14,2) not null check(amount>0), account_id uuid references public.finance_accounts(id) on delete set null,
 payment_method text, document_url text, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.finance_budgets(
 id uuid primary key default gen_random_uuid(), title text not null, department text,
 project_id uuid references public.company_projects(id) on delete set null, period_start date not null, period_end date not null check(period_end>=period_start),
 budget_amount numeric(14,2) not null check(budget_amount>=0), notes text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.finance_transfers(
 id uuid primary key default gen_random_uuid(), transfer_date date not null,
 from_account_id uuid not null references public.finance_accounts(id), to_account_id uuid not null references public.finance_accounts(id),
 amount numeric(14,2) not null check(amount>0), fee_amount numeric(14,2) not null default 0 check(fee_amount>=0),
 document_url text, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 check(from_account_id<>to_account_id)
);
create table if not exists public.finance_advances(
 id uuid primary key default gen_random_uuid(), advance_type text not null check(advance_type in('advance','reimbursement')),
 beneficiary_name text not null, request_date date not null, settlement_due_date date, amount numeric(14,2) not null check(amount>0),
 department text, project_id uuid references public.company_projects(id) on delete set null,
 status text not null default 'requested' check(status in('requested','approved','paid','settled','rejected','cancelled')),
 purpose text not null, document_url text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.finance_accounts enable row level security;
alter table public.finance_obligations enable row level security;
alter table public.finance_payments enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_transfers enable row level security;
alter table public.finance_advances enable row level security;
do $$ declare t text; begin
 foreach t in array array['finance_accounts','finance_obligations','finance_payments','finance_budgets','finance_transfers','finance_advances'] loop
  execute format('drop policy if exists admin_access on public.%I',t);
  execute format('create policy admin_access on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;
create or replace view public.finance_account_balances with(security_invoker=true) as
select a.*,
 (a.opening_balance
  +coalesce((select sum(case when t.direction='income' then t.amount else -t.amount end) from public.institutional_transactions t where t.account_id=a.id and coalesce(t.approval_status,'approved')='approved'),0)
  +coalesce((select sum(tr.amount) from public.finance_transfers tr where tr.to_account_id=a.id),0)
  -coalesce((select sum(tr.amount+tr.fee_amount) from public.finance_transfers tr where tr.from_account_id=a.id),0)
 )::numeric(14,2) current_balance
from public.finance_accounts a;
grant select on public.finance_account_balances to authenticated;
create or replace view public.finance_budget_execution with(security_invoker=true) as
select b.*,
 coalesce((select sum(t.amount) from public.institutional_transactions t where t.direction='expense' and coalesce(t.approval_status,'approved')='approved'
  and t.transaction_date between b.period_start and b.period_end and (b.department is null or t.department=b.department) and (b.project_id is null or t.project_id=b.project_id)),0)::numeric(14,2) spent_amount
from public.finance_budgets b;
grant select on public.finance_budget_execution to authenticated;
create or replace view public.finance_summary with(security_invoker=true) as
select
 coalesce((select sum(current_balance) from public.finance_account_balances where is_active),0)::numeric(14,2) total_balance,
 coalesce((select sum(amount) from public.institutional_transactions where direction='income' and coalesce(approval_status,'approved')='approved' and date_trunc('month',transaction_date)=date_trunc('month',current_date)),0)::numeric(14,2) month_income,
 coalesce((select sum(amount) from public.institutional_transactions where direction='expense' and coalesce(approval_status,'approved')='approved' and date_trunc('month',transaction_date)=date_trunc('month',current_date)),0)::numeric(14,2) month_expenses,
 (coalesce((select sum(case when direction='income' then amount else -amount end) from public.institutional_transactions where coalesce(approval_status,'approved')='approved' and date_trunc('month',transaction_date)=date_trunc('month',current_date)),0))::numeric(14,2) month_result,
 coalesce((select sum(total_amount-paid_amount) from public.finance_obligations where obligation_type='receivable' and status not in('paid','cancelled')),0)::numeric(14,2) total_receivable,
 coalesce((select sum(total_amount-paid_amount) from public.finance_obligations where obligation_type='payable' and status not in('paid','cancelled')),0)::numeric(14,2) total_payable,
 coalesce((select sum(budget_amount-spent_amount) from public.finance_budget_execution),0)::numeric(14,2) available_budget,
 coalesce((select sum(amount) from public.finance_advances where advance_type='advance' and status in('approved','paid')),0)::numeric(14,2) pending_advances;
grant select on public.finance_summary to authenticated;
create or replace view public.finance_transfers_display with(security_invoker=true) as
select t.*,f.account_name from_account_name,d.account_name to_account_name from public.finance_transfers t
join public.finance_accounts f on f.id=t.from_account_id join public.finance_accounts d on d.id=t.to_account_id;
grant select on public.finance_transfers_display to authenticated;
