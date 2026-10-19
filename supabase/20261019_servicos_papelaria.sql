-- Executar depois de 20261019_caixa_comercio.sql.
begin;
alter table public.retail_products add column kind text not null default 'product' check(kind in ('product','service','supply')),
 add column unit_label text not null default 'unidade';
alter table public.retail_products add constraint stationery_items_only check(area='papelaria' or kind='product');
create table public.retail_service_components (
 service_id uuid not null references public.retail_products(id), supply_id uuid not null references public.retail_products(id),
 per_unit numeric(18,6) not null default 0 check(per_unit>=0), per_job numeric(18,6) not null default 0 check(per_job>=0),
 primary key(service_id,supply_id), check(service_id<>supply_id),check(per_unit+per_job>0)
);
create table public.retail_service_consumptions (
 id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.retail_movements(id),
 supply_id uuid not null references public.retail_products(id),quantity numeric(18,6) not null check(quantity>0),
 unit_cost numeric(18,6) not null check(unit_cost>=0),total_cost numeric(14,2) not null check(total_cost>=0),
 unique(sale_id,supply_id)
);
alter table public.retail_service_components enable row level security;
alter table public.retail_service_consumptions enable row level security;
create policy retail_read on public.retail_service_components for select to authenticated using(true);
create policy retail_read on public.retail_service_consumptions for select to authenticated using(true);
revoke all on public.retail_service_components,public.retail_service_consumptions from anon,authenticated;
grant select on public.retail_service_components,public.retail_service_consumptions to authenticated;
-- Preservar as colunas existentes e anexar o tipo/unidade; os serviços não são stock físico.
create or replace view public.retail_stock with(security_invoker=true) as
select p.id,p.area,p.name,p.unit_price,
 (case when p.kind='service' then 0 else coalesce(m.quantity,0)-coalesce(c.quantity,0) end)::bigint stock,
 p.average_cost,
 case when p.kind='service' then 0 else round((coalesce(m.quantity,0)-coalesce(c.quantity,0))*p.average_cost,2) end stock_value,
 p.kind,p.unit_label,
 (case when p.kind='service' then 0 else coalesce(m.quantity,0)-coalesce(c.quantity,0) end)::numeric stock_quantity
from public.retail_products p
left join (select product_id,sum(case when kind='entry' then quantity else -quantity end) quantity from public.retail_movements group by product_id) m on m.product_id=p.id
left join (select supply_id,sum(quantity) quantity from public.retail_service_consumptions group by supply_id) c on c.supply_id=p.id;
create or replace function public.register_retail_movement(p_product uuid,p_date date,p_kind text,p_quantity integer,p_price numeric,p_paid numeric,p_customer text,p_notes text,p_entry_cost numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare available numeric; total numeric(14,2); movement_id uuid; average numeric; current_cost numeric; item_kind text; recipe record; required_quantity numeric; service_cost numeric:=0;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 select average_cost,kind into average,item_kind from retail_products where id=p_product for update;
 if not found then raise exception 'Produto não encontrado.'; end if;
 if item_kind='service' and p_kind<>'sale' then raise exception 'Serviços não têm entrada de stock nem perdas.'; end if;
 if item_kind='supply' and p_kind='sale' then raise exception 'Consumíveis são usados nos serviços; não são vendidos separadamente.'; end if;
 if p_kind is null or p_kind not in ('entry','sale','loss') or p_quantity is null or p_quantity<=0 or p_date is null then raise exception 'Movimento inválido.'; end if;
 select coalesce(sum(case when kind='entry' then quantity else -quantity end),0) into available from retail_movements where product_id=p_product;
 select available-coalesce(sum(quantity),0) into available from retail_service_consumptions where supply_id=p_product;
 if item_kind<>'service' and p_kind<>'entry' and p_quantity>available then raise exception 'Quantidade superior ao stock disponível.'; end if;
 total:=case when p_kind='sale' then round(p_quantity*p_price,2) else 0 end;
 if total is null or total<0 or p_paid is null or p_paid<0 or p_paid>total then raise exception 'Valor pago ou preço inválido.'; end if;
 if p_kind='sale' and nullif(trim(p_customer),'') is null then raise exception 'Indique o cliente.'; end if;
 if item_kind='service' then
   if not exists(select 1 from retail_service_components where service_id=p_product) then raise exception 'Configure os consumíveis deste serviço antes de vender.'; end if;
   for recipe in select c.*,p.name,p.average_cost from retail_service_components c join retail_products p on p.id=c.supply_id where c.service_id=p_product order by p.id for update of p loop
     required_quantity:=recipe.per_unit*p_quantity+recipe.per_job;
     if recipe.average_cost is null then raise exception 'Indique o custo do consumível: %',recipe.name; end if;
     select coalesce(sum(case when kind='entry' then quantity else -quantity end),0) into available from retail_movements where product_id=recipe.supply_id;
     select available-coalesce(sum(quantity),0) into available from retail_service_consumptions where supply_id=recipe.supply_id;
     if required_quantity>available then raise exception 'Stock insuficiente de %.',recipe.name; end if;
     service_cost:=service_cost+round(required_quantity*recipe.average_cost,2);
   end loop;
   current_cost:=service_cost/p_quantity;
 elsif p_kind='entry' then
   if p_entry_cost is null or p_entry_cost<0 or p_entry_cost='NaN'::numeric then raise exception 'Indique o custo total de aquisição ou produção.'; end if;
   if available>0 and average is null then raise exception 'Valorize primeiro o stock existente.'; end if;
   current_cost:=round(p_entry_cost/p_quantity,6);
   update retail_products set average_cost=(coalesce(average,0)*available+p_entry_cost)/(available+p_quantity) where id=p_product;
 else
   if average is null then raise exception 'Valorize primeiro o stock existente.'; end if;
   current_cost:=average;
 end if;
 insert into retail_movements(product_id,movement_date,kind,quantity,total_amount,amount_paid,customer_name,notes,created_by,unit_cost,total_cost)
 values(p_product,p_date,p_kind,p_quantity,total,p_paid,nullif(trim(p_customer),''),p_notes,auth.uid(),current_cost,case when item_kind='service' then service_cost when p_kind='entry' then round(p_entry_cost,2) else round(current_cost*p_quantity,2) end) returning id into movement_id;
 if item_kind='service' then
   insert into retail_service_consumptions(sale_id,supply_id,quantity,unit_cost,total_cost)
   select movement_id,c.supply_id,c.per_unit*p_quantity+c.per_job,p.average_cost,round((c.per_unit*p_quantity+c.per_job)*p.average_cost,2)
   from retail_service_components c join retail_products p on p.id=c.supply_id where c.service_id=p_product;
 end if;
 if p_paid>0 then insert into retail_payments(sale_id,payment_date,amount,created_by) values(movement_id,p_date,p_paid,auth.uid()); end if;
 return movement_id;
end $$;


create function public.set_retail_service_component(p_service uuid,p_supply uuid,p_per_unit numeric,p_per_job numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 perform 1 from retail_products where id=p_service and area='papelaria' and kind='service' for update;
 if not found then raise exception 'Serviço não encontrado.'; end if;
 perform 1 from retail_products where id=p_supply and area='papelaria' and kind='supply';
 if not found then raise exception 'Consumível não encontrado.'; end if;
 if p_per_unit is null or p_per_job is null or p_per_unit<0 or p_per_job<0 or p_per_unit='NaN'::numeric or p_per_job='NaN'::numeric then raise exception 'Consumo inválido.'; end if;
 if p_per_unit+p_per_job=0 then delete from retail_service_components where service_id=p_service and supply_id=p_supply; return; end if;
 insert into retail_service_components(service_id,supply_id,per_unit,per_job) values(p_service,p_supply,p_per_unit,p_per_job)
 on conflict(service_id,supply_id) do update set per_unit=excluded.per_unit,per_job=excluded.per_job;
end $$;
revoke all on function public.set_retail_service_component(uuid,uuid,numeric,numeric) from public;
grant execute on function public.set_retail_service_component(uuid,uuid,numeric,numeric) to authenticated;
commit;
