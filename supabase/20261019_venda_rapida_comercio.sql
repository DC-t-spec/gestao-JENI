-- Executar depois de 20261019_custos_comercio.sql.
begin;
alter table public.retail_movements add column payment_method text
 check(payment_method in ('cash','mpesa','emola','bank_transfer','credit'));
alter table public.retail_payments add column payment_method text
 check(payment_method in ('cash','mpesa','emola','bank_transfer'));
-- Preço e custo são lidos do produto, dentro da mesma transacção da venda.
create function public.register_retail_sale(
 p_product uuid,p_quantity integer,p_payment_method text,
 p_customer text default null,p_paid numeric default null,p_date date default current_date,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare price numeric; total numeric; paid numeric; new_sale_id uuid; customer text;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 if p_payment_method is null or p_payment_method not in ('cash','mpesa','emola','bank_transfer','credit') then raise exception 'Seleccione a forma de pagamento.'; end if;
 select unit_price into price from retail_products where id=p_product for update;
 if not found then raise exception 'Produto não encontrado.'; end if;
 total:=round(price*p_quantity,2);
 paid:=case when p_payment_method='credit' then 0 else coalesce(p_paid,total) end;
 if p_payment_method='credit' and coalesce(p_paid,0)<>0 then raise exception 'Venda a crédito não pode ter pagamento inicial.'; end if;
 customer:=nullif(trim(p_customer),'');
 if paid<total and customer is null then raise exception 'Indique o cliente para guardar a dívida.'; end if;
 new_sale_id:=register_retail_movement(p_product,p_date,'sale',p_quantity,price,paid,coalesce(customer,'Consumidor final'),p_notes,null);
 update retail_movements set payment_method=p_payment_method where id=new_sale_id;
 update retail_payments set payment_method=p_payment_method where sale_id=new_sale_id;
 return new_sale_id;
end $$;
revoke all on function public.register_retail_sale(uuid,integer,text,text,numeric,date,text) from public;
grant execute on function public.register_retail_sale(uuid,integer,text,text,numeric,date,text) to authenticated;
commit;
