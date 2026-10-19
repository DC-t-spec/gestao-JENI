-- Aplicar no SQL Editor do Supabase depois das migrações existentes.
begin;
create or replace view public.egg_business_summary with(security_invoker=true) as select
coalesce((select sum(quantity) from layer_entries),0)-coalesce((select sum(quantity) from layer_mortality),0) layers_alive,
coalesce((select sum(egg_count) from egg_production),0) eggs_produced,
coalesce((select sum(egg_quantity) from egg_sales),0) eggs_sold,
coalesce((select sum(egg_count) from egg_production),0)-coalesce((select sum(egg_quantity) from egg_sales),0) eggs_in_stock,
coalesce((select sum(total_amount) from egg_sales where payment_method is not null),0)::numeric(14,2) egg_revenue;
create or replace view public.company_financial_summary with(security_invoker=true) as select
(coalesce((select sum(total_amount) from sales),0)+coalesce((select sum(total_amount) from egg_sales where payment_method is not null),0))::numeric(14,2) poultry_revenue,
coalesce((select sum(income_amount) from company_projects),0)::numeric(14,2) project_income,
coalesce((select sum(amount) from partner_dues),0)::numeric(14,2) partner_dues,
(coalesce((select sum(total_amount) from sales),0)+coalesce((select sum(total_amount) from egg_sales where payment_method is not null),0)+coalesce((select sum(income_amount) from company_projects),0)+coalesce((select sum(amount) from partner_dues),0))::numeric(14,2) total_income;

create or replace view public.management_dashboard with(security_invoker=true) as
select
 coalesce((select sum(amount) from public.institutional_transactions where direction='income'),0)::numeric(14,2) institutional_income,
 coalesce((select sum(amount) from public.institutional_transactions where direction='expense'),0)::numeric(14,2) institutional_expenses,
 (coalesce((select sum(amount) from public.institutional_transactions where direction='income'),0)-
  coalesce((select sum(amount) from public.institutional_transactions where direction='expense'),0))::numeric(14,2) institutional_balance,
 coalesce((select sum(total_amount) from public.sales),0)::numeric(14,2) chicken_revenue,
 coalesce((select sum(total_amount) from public.egg_sales where payment_method is not null),0)::numeric(14,2) egg_revenue,
 coalesce((select sum(income_amount) from public.company_projects),0)::numeric(14,2) project_income,
 coalesce((select sum(amount) from public.partner_dues),0)::numeric(14,2) partner_dues_income,
 coalesce((select count(*) from public.funding_opportunities where status in('identified','preparing','submitted')),0)::integer active_applications,
 coalesce((select count(*) from public.company_tasks where status not in('completed','cancelled')),0)::integer pending_tasks,
 coalesce((select count(*) from public.company_tasks where status not in('completed','cancelled') and due_date<current_date),0)::integer overdue_tasks,
 coalesce((select count(*) from public.partners where is_active=true),0)::integer active_partners;

create table public.retail_products (
 id uuid primary key default gen_random_uuid(), area text not null check(area in ('papelaria','gelinhos')),
 name text not null check(length(trim(name))>0), unit_price numeric(14,2) not null check(unit_price>=0),
 created_by uuid not null default auth.uid() references auth.users(id), unique(area,name)
);
create table public.retail_movements (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.retail_products(id),
 movement_date date not null, kind text not null check(kind in ('entry','sale','loss')),
 quantity integer not null check(quantity>0), total_amount numeric(14,2) not null default 0 check(total_amount>=0),
 amount_paid numeric(14,2) not null default 0 check(amount_paid>=0 and amount_paid<=total_amount),
 customer_name text, notes text, created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), check(kind='sale' or (total_amount=0 and amount_paid=0))
);
create table public.retail_payments (
 id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.retail_movements(id),
 payment_date date not null, amount numeric(14,2) not null check(amount>0),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
alter table public.retail_products enable row level security;
alter table public.retail_movements enable row level security;
alter table public.retail_payments enable row level security;
create policy retail_read on public.retail_products for select to authenticated using(true);
create policy retail_create on public.retail_products for insert to authenticated with check(created_by=auth.uid());
create policy retail_read on public.retail_movements for select to authenticated using(true);
create policy retail_read on public.retail_payments for select to authenticated using(true);
revoke all on public.retail_products,public.retail_movements,public.retail_payments from anon,authenticated;
grant select,insert on public.retail_products to authenticated;
grant select on public.retail_movements,public.retail_payments to authenticated;
create view public.retail_stock with(security_invoker=true) as
select p.id,p.area,p.name,p.unit_price,coalesce(sum(case when m.kind='entry' then m.quantity else -m.quantity end),0)::bigint stock
from public.retail_products p left join public.retail_movements m on m.product_id=p.id group by p.id;
grant select on public.retail_stock to authenticated;
create function public.register_retail_movement(p_product uuid,p_date date,p_kind text,p_quantity integer,p_price numeric,p_paid numeric,p_customer text,p_notes text)
returns uuid language plpgsql security definer set search_path=public as $$
declare available bigint; total numeric(14,2); movement_id uuid;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 perform 1 from retail_products where id=p_product for update;
 if not found then raise exception 'Produto não encontrado.'; end if;
 if p_kind is null or p_kind not in ('entry','sale','loss') or p_quantity is null or p_quantity<=0 or p_date is null then raise exception 'Movimento inválido.'; end if;
 select coalesce(sum(case when kind='entry' then quantity else -quantity end),0) into available from retail_movements where product_id=p_product;
 if p_kind<>'entry' and p_quantity>available then raise exception 'Quantidade superior ao stock disponível.'; end if;
 total:=case when p_kind='sale' then round(p_quantity*p_price,2) else 0 end;
 if total is null or total<0 or p_paid is null or p_paid<0 or p_paid>total then raise exception 'Valor pago ou preço inválido.'; end if;
 if p_kind='sale' and nullif(trim(p_customer),'') is null then raise exception 'Indique o cliente.'; end if;
 insert into retail_movements(product_id,movement_date,kind,quantity,total_amount,amount_paid,customer_name,notes,created_by)
 values(p_product,p_date,p_kind,p_quantity,total,p_paid,nullif(trim(p_customer),''),p_notes,auth.uid()) returning id into movement_id;
 if p_paid>0 then insert into retail_payments(sale_id,payment_date,amount,created_by) values(movement_id,p_date,p_paid,auth.uid()); end if;
 return movement_id;
end $$;
create function public.register_retail_payment(p_sale uuid,p_date date,p_amount numeric)
returns void language plpgsql security definer set search_path=public as $$
declare sale retail_movements;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 select * into sale from retail_movements where id=p_sale and kind='sale' for update;
 if not found then raise exception 'Venda não encontrada.'; end if;
 if p_date is null or p_amount is null or round(p_amount,2)<=0 or round(p_amount,2)>sale.total_amount-sale.amount_paid then raise exception 'Pagamento superior à dívida ou inválido.'; end if;
 update retail_movements set amount_paid=amount_paid+round(p_amount,2) where id=p_sale;
 insert into retail_payments(sale_id,payment_date,amount,created_by) values(p_sale,p_date,round(p_amount,2),auth.uid());
end $$;
revoke all on function public.register_retail_movement(uuid,date,text,integer,numeric,numeric,text,text) from public;
revoke all on function public.register_retail_payment(uuid,date,numeric) from public;
grant execute on function public.register_retail_movement(uuid,date,text,integer,numeric,numeric,text,text) to authenticated;
grant execute on function public.register_retail_payment(uuid,date,numeric) to authenticated;
commit;
