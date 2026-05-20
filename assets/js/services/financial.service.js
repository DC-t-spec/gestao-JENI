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

export async function createManualDeposit(payload) {
  const createdBy = payload.created_by || getCurrentUserId();
  if (!createdBy) throw new Error('Utilizador autenticado não encontrado para created_by.');
  if (!payload.account_id) throw new Error('Conta destino é obrigatória.');
  if (Number(payload.amount) <= 0) throw new Error('Valor deve ser maior que zero.');

  return createFinancialTransaction({
    transaction_date: payload.transaction_date,
    account_id: payload.account_id,
    direction: 'in',
    transaction_type: 'manual_entry',
    amount: Number(payload.amount),
    reference_type: 'manual_deposit',
    reference_id: null,
    description: payload.description || null,
    notes: payload.description || null,
    created_by: createdBy,
  });
}

export async function createAccountTransfer(payload) {
  const createdBy = payload.created_by || getCurrentUserId();
  const amount = Number(payload.amount || 0);

  if (!createdBy) throw new Error('Utilizador autenticado não encontrado para created_by.');
  if (!payload.from_account_id || !payload.to_account_id) throw new Error('Conta origem e destino são obrigatórias.');
  if (payload.from_account_id === payload.to_account_id) throw new Error('Conta origem deve ser diferente da conta destino.');
  if (amount <= 0) throw new Error('Valor deve ser maior que zero.');

  const { data: accounts, error: accountsError } = await supabase
    .from('financial_accounts')
    .select('id, is_active')
    .in('id', [payload.from_account_id, payload.to_account_id]);
  if (accountsError) throw accountsError;

  if ((accounts || []).length !== 2 || (accounts || []).some((account) => !account.is_active)) {
    throw new Error('Transferência inválida: selecione apenas contas activas.');
  }

  const note = payload.description || null;
  const transactionDate = payload.transaction_date;
  const transferGroupId = globalThis.crypto?.randomUUID?.() || `transfer_${Date.now()}`;
  const transferRows = [
    {
      transaction_date: transactionDate,
      account_id: payload.from_account_id,
      direction: 'out',
      transaction_type: 'transfer_out',
      amount,
      reference_type: 'account_transfer',
      reference_id: transferGroupId,
      description: note,
      notes: note,
      created_by: createdBy,
    },
    {
      transaction_date: transactionDate,
      account_id: payload.to_account_id,
      direction: 'in',
      transaction_type: 'transfer_in',
      amount,
      reference_type: 'account_transfer',
      reference_id: transferGroupId,
      description: note,
      notes: note,
      created_by: createdBy,
    },
  ];

  const isLocalhost = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);
  if (isLocalhost) {
    console.info('[financial][transfer] payload_out', transferRows[0]);
    console.info('[financial][transfer] payload_in', transferRows[1]);
  }

  const { data, error } = await supabase
    .from('financial_transactions')
    .insert(transferRows)
    .select('*');

  if (isLocalhost) {
    console.info('[financial][transfer] supabase_response', { data, error });
  }

  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 2) {
    throw new Error('Falha ao gravar transferência completa. Nenhuma operação foi concluída.');
  }

  const hasTransferOut = data.some((row) => row.transaction_type === 'transfer_out');
  const hasTransferIn = data.some((row) => row.transaction_type === 'transfer_in');
  if (!hasTransferOut || !hasTransferIn) {
    throw new Error('Transferência inconsistente detectada. Verifique as permissões de inserção.');
  }

  return data || [];
}
