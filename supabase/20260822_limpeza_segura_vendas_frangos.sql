-- Executar uma vez no SQL Editor do Supabase.
-- A função só pode ser utilizada por administradores autenticados da JENI.
-- Todas as eliminações são realizadas na mesma transacção.

create or replace function public.clear_chicken_sales()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_sales integer := 0;
  deleted_payments integer := 0;
  deleted_transactions integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores autenticados podem eliminar vendas de frangos.'
      using errcode = '42501';
  end if;

  delete from public.financial_transactions
  where reference_type in ('sale', 'sale_payment');
  get diagnostics deleted_transactions = row_count;

  delete from public.sale_payments;
  get diagnostics deleted_payments = row_count;

  delete from public.sales;
  get diagnostics deleted_sales = row_count;

  return jsonb_build_object(
    'sales', deleted_sales,
    'payments', deleted_payments,
    'transactions', deleted_transactions
  );
end;
$$;

revoke all on function public.clear_chicken_sales() from public;
revoke all on function public.clear_chicken_sales() from anon;
grant execute on function public.clear_chicken_sales() to authenticated;
