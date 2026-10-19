-- Executar depois de 20261019_comercio_e_receitas.sql.
begin;
alter table public.retail_products add column average_cost numeric(18,6) check(average_cost>=0);
alter table public.retail_movements add column unit_cost numeric(18,6) check(unit_cost>=0), add column total_cost numeric(14,2) check(total_cost>=0);
-- Valores antigos ficam desconhecidos: não assumir custo zero nem inventar lucro.
create or replace view public.retail_stock with(security_invoker=true) as
select p.id,p.area,p.name,p.unit_price,
 coalesce(sum(case when m.kind='entry' then m.quantity else -m.quantity end),0)::bigint stock,
 p.average_cost,
 round(coalesce(sum(case when m.kind='entry' then m.quantity else -m.quantity end),0)*p.average_cost,2) stock_value
from public.retail_products p left join public.retail_movements m on m.product_id=p.id group by p.id;
drop function public.register_retail_movement(uuid,date,text,integer,numeric,numeric,text,text);
create function public.register_retail_movement(p_product uuid,p_date date,p_kind text,p_quantity integer,p_price numeric,p_paid numeric,p_customer text,p_notes text,p_entry_cost numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare available bigint; total numeric(14,2); movement_id uuid; average numeric; current_cost numeric;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 select average_cost into average from retail_products where id=p_product for update;
 if not found then raise exception 'Produto não encontrado.'; end if;
 if p_kind is null or p_kind not in ('entry','sale','loss') or p_quantity is null or p_quantity<=0 or p_date is null then raise exception 'Movimento inválido.'; end if;
 select coalesce(sum(case when kind='entry' then quantity else -quantity end),0) into available from retail_movements where product_id=p_product;
 if p_kind<>'entry' and p_quantity>available then raise exception 'Quantidade superior ao stock disponível.'; end if;
 total:=case when p_kind='sale' then round(p_quantity*p_price,2) else 0 end;
 if total is null or total<0 or p_paid is null or p_paid<0 or p_paid>total then raise exception 'Valor pago ou preço inválido.'; end if;
 if p_kind='sale' and nullif(trim(p_customer),'') is null then raise exception 'Indique o cliente.'; end if;
 if p_kind='entry' then
   if p_entry_cost is null or p_entry_cost<0 or p_entry_cost='NaN'::numeric then raise exception 'Indique o custo total de aquisição ou produção.'; end if;
   if available>0 and average is null then raise exception 'Valorize primeiro o stock existente.'; end if;
   current_cost:=round(p_entry_cost/p_quantity,6);
   update retail_products set average_cost=(coalesce(average,0)*available+p_entry_cost)/(available+p_quantity) where id=p_product;
 else
   if average is null then raise exception 'Valorize primeiro o stock existente.'; end if;
   current_cost:=average;
 end if;
 insert into retail_movements(product_id,movement_date,kind,quantity,total_amount,amount_paid,customer_name,notes,created_by,unit_cost,total_cost)
 values(p_product,p_date,p_kind,p_quantity,total,p_paid,nullif(trim(p_customer),''),p_notes,auth.uid(),current_cost,case when p_kind='entry' then round(p_entry_cost,2) else round(current_cost*p_quantity,2) end) returning id into movement_id;
 if p_paid>0 then insert into retail_payments(sale_id,payment_date,amount,created_by) values(movement_id,p_date,p_paid,auth.uid()); end if;
 return movement_id;
end $$;

revoke all on function public.register_retail_movement(uuid,date,text,integer,numeric,numeric,text,text,numeric) from public;
grant execute on function public.register_retail_movement(uuid,date,text,integer,numeric,numeric,text,text,numeric) to authenticated;
-- Só permite atribuir a primeira valorização; não reescreve vendas antigas.
create function public.value_retail_stock(p_product uuid,p_unit_cost numeric) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 if p_unit_cost is null or p_unit_cost<0 or p_unit_cost='NaN'::numeric then raise exception 'Custo inválido.'; end if;
 perform 1 from retail_products where id=p_product and average_cost is null for update;
 if not found then raise exception 'Produto inexistente ou já valorizado.'; end if;
 update retail_products set average_cost=p_unit_cost where id=p_product;
end $$;
revoke all on function public.value_retail_stock(uuid,numeric) from public;
grant execute on function public.value_retail_stock(uuid,numeric) to authenticated;
commit;
