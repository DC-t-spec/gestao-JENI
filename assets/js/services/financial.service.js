import { supabase } from '../core/supabase-client.js';
import { getCurrentUserId } from '../core/utils.js';

const PAYMENT_METHOD_TO_ACCOUNT_TYPE = Object.freeze({
  cash: 'cash',
  mpesa: 'mpesa',
  emola: 'emola',
  bank_transfer: 'bank',
  bank: 'bank',
  card: 'card',
  other: 'other',
});

export function mapPaymentMethodToAccountType(paymentMethod) {
  const normalizedPaymentMethod = String(paymentMethod || '').trim().toLowerCase();
  const accountType = PAYMENT_METHOD_TO_ACCOUNT_TYPE[normalizedPaymentMethod];

  if (!accountType) {
    throw new Error(`Método de pagamento inválido: ${paymentMethod || 'não informado'}.`);
  }

  return accountType;
}

export function findAccountByPaymentMethod(accounts, paymentMethod) {
  const accountType = mapPaymentMethodToAccountType(paymentMethod);
  return (accounts || []).find((account) => account.type === accountType) || null;
}

export async function getFinancialAccountBalances() {
  const { data, error } = await supabase
    .from('financial_account_balances')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getReceivablesSummary() {
  const { data, error } = await supabase
    .from('receivables_summary')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getFinancialTransactions(limit = 20) {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function createFinancialTransaction(payload) {
  const createdBy = payload.created_by || getCurrentUserId();
  if (!createdBy) {
    throw new Error('Utilizador autenticado não encontrado para created_by.');
  }

  if (payload.reference_type && payload.reference_id) {
    const { data: existingReference, error: existingReferenceError } = await supabase
      .from('financial_transactions')
      .select('id')
      .eq('reference_type', payload.reference_type)
      .eq('reference_id', payload.reference_id)
      .maybeSingle();

    if (existingReferenceError) throw existingReferenceError;
    if (existingReference) return existingReference;
  }

  const dataToInsert = {
    transaction_date: payload.transaction_date,
    account_id: payload.account_id,
    direction: payload.direction,
    transaction_type: payload.transaction_type,
    amount: Number(payload.amount || 0),
    reference_type: payload.reference_type || null,
    reference_id: payload.reference_id || null,
    description: payload.description || null,
    notes: payload.notes || null,
    created_by: createdBy,
  };

  const { data, error } = await supabase
    .from('financial_transactions')
    .insert(dataToInsert)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getActiveFinancialAccounts() {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('id, name, type, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function buildFinancialAccountOptions(accounts, { placeholder = 'Selecionar conta' } = {}) {
  const emptyOption = `<option value="">${placeholder}</option>`;
  const options = (accounts || [])
    .map((account) => `<option value="${account.id}">${account.name}</option>`)
    .join('');

  return emptyOption + options;
}
