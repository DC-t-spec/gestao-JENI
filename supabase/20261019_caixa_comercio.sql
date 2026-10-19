-- Executar depois de 20261019_venda_rapida_comercio.sql.
begin;
alter table public.retail_movements add column funding_source text
 check(funding_source is null or (funding_source in ('capital','sales') and kind='entry'));
-- Não deduzir a origem de compras antigas: o utilizador confirma no histórico.
create function public.register_retail_purchase(
 p_product uuid,p_date date,p_quantity integer,p_entry_cost numeric,p_funding_source text,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare movement_id uuid;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 if p_funding_source is null or p_funding_source not in ('capital','sales') then raise exception 'Indique de onde saiu o dinheiro da compra.'; end if;
 movement_id:=register_retail_movement(p_product,p_date,'entry',p_quantity,0,0,null,p_notes,p_entry_cost);
 update retail_movements set funding_source=p_funding_source where id=movement_id;
 return movement_id;
end $$;
create function public.set_retail_purchase_funding(p_movement uuid,p_funding_source text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 if p_funding_source is null or p_funding_source not in ('capital','sales') then raise exception 'Origem do dinheiro inválida.'; end if;
 update retail_movements set funding_source=p_funding_source where id=p_movement and kind='entry';
 if not found then raise exception 'Compra não encontrada.'; end if;
end $$;
revoke all on function public.register_retail_purchase(uuid,date,integer,numeric,text,text) from public;
revoke all on function public.set_retail_purchase_funding(uuid,text) from public;
grant execute on function public.register_retail_purchase(uuid,date,integer,numeric,text,text) to authenticated;
grant execute on function public.set_retail_purchase_funding(uuid,text) to authenticated;
commit;
