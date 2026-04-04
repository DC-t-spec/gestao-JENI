import { supabase } from './supabase-client.js';

export const state = {
  currentUser: null,
  profile: null,
  route: 'dashboard',
  batches: [],
};

export async function getRecentSales(limit = 20) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      sale_date,
      customer_name,
      quantity,
      total_amount,
      amount_paid,
      amount_due,
      payment_status,
      due_date,
      customer_contact,
      batch_id
    `)
    .order('sale_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getSaleById(saleId) {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('id', saleId)
    .single();

  if (error) throw error;
  return data;
}

export async function getSalePayments(saleId) {
  const { data, error } = await supabase
    .from('sale_payments')
    .select(`
      id,
      sale_id,
      payment_date,
      amount_paid,
      payment_method,
      notes,
      created_at,
      created_by
    `)
    .eq('sale_id', saleId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createSalePayment({
  saleId,
  paymentDate,
  amountPaid,
  paymentMethod,
  notes,
}) {
  const numericAmount = Number(amountPaid || 0);

  if (!saleId) {
    throw new Error('Venda inválida.');
  }

  if (!numericAmount || numericAmount <= 0) {
    throw new Error('O valor pago deve ser maior que zero.');
  }

  const sale = await getSaleById(saleId);

  if (!sale) {
    throw new Error('Venda não encontrada.');
  }

  if (Number(sale.amount_due || 0) <= 0) {
    throw new Error('Esta venda já está totalmente paga.');
  }

  if (numericAmount > Number(sale.amount_due || 0)) {
    throw new Error('O valor pago não pode ser maior que a dívida atual.');
  }

  const payload = {
    sale_id: saleId,
    payment_date: paymentDate,
    amount_paid: numericAmount,
    payment_method: paymentMethod || null,
    notes: notes || null,
    created_by: state.currentUser?.id || null,
  };

  const { data, error } = await supabase
    .from('sale_payments')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getDebtorSales() {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      sale_date,
      customer_name,
      customer_contact,
      total_amount,
      amount_paid,
      amount_due,
      payment_status,
      due_date,
      batch_id
    `)
    .gt('amount_due', 0)
    .order('sale_date', { ascending: false });

  if (error) throw error;
  return data || [];
}
