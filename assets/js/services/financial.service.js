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

export function validateFinancialAccountBalances(accounts, transactions, {
  chickenSales = [],
  eggSales = [],
  salePayments = null,
} = {}) {
  const chickenById = new Map((chickenSales || []).map((sale) => [String(sale.id), sale]));
  const eggsById = new Map((eggSales || []).map((sale) => [String(sale.id), sale]));
  const paymentsById = salePayments === null
    ? null
    : new Map((salePayments || []).map((payment) => [String(payment.id), payment]));
  const remainingChickenPayments = new Map((chickenSales || []).map((sale) => {
    const paidAmount = sale.amount_paid === null || sale.amount_paid === undefined
      ? Number(sale.total_amount || 0) - Number(sale.amount_due || 0)
      : Number(sale.amount_paid || 0);
    return [String(sale.id), Math.max(paidAmount, 0)];
  }));
  const remainingEggPayments = new Map((eggSales || []).map((sale) => [
    String(sale.id),
    sale.payment_method ? Math.max(Number(sale.total_amount || 0), 0) : 0,
  ]));
  const adjustmentsByAccount = new Map();
  const validTransactions = [];
  const ignoredTransactions = [];
  const orderedTransactions = (transactions || []).map((transaction, index) => ({ transaction, index }))
    .sort((left, right) => {
      const leftPriority = left.transaction.reference_type === 'sale' ? 0 : 1;
      const rightPriority = right.transaction.reference_type === 'sale' ? 0 : 1;
      return leftPriority - rightPriority || left.index - right.index;
    });

  for (const { transaction } of orderedTransactions) {
    const originalAmount = Math.max(Number(transaction.amount || 0), 0);
    const referenceType = String(transaction.reference_type || '');
    const referenceId = String(transaction.reference_id || '');
    let acceptedAmount = originalAmount;

    if (referenceType === 'sale') {
      const sale = chickenById.get(referenceId);
      const available = remainingChickenPayments.get(referenceId) || 0;
      acceptedAmount = sale ? Math.min(originalAmount, available) : 0;
      if (sale) remainingChickenPayments.set(referenceId, available - acceptedAmount);
    } else if (referenceType === 'sale_payment' && paymentsById !== null) {
      const payment = paymentsById.get(referenceId);
      const saleId = String(payment?.sale_id || '');
      const sale = chickenById.get(saleId);
      const available = remainingChickenPayments.get(saleId) || 0;
      const paymentAmount = Math.max(Number(payment?.amount_paid || 0), 0);
      acceptedAmount = payment && sale ? Math.min(originalAmount, paymentAmount, available) : 0;
      if (payment && sale) remainingChickenPayments.set(saleId, available - acceptedAmount);
    } else if (referenceType === 'egg_sale') {
      const sale = eggsById.get(referenceId);
      const available = remainingEggPayments.get(referenceId) || 0;
      acceptedAmount = sale?.payment_method ? Math.min(originalAmount, available) : 0;
      if (sale?.payment_method) remainingEggPayments.set(referenceId, available - acceptedAmount);
    }

    const ignoredAmount = originalAmount - acceptedAmount;
    if (ignoredAmount > 0) {
      const accountId = String(transaction.account_id || '');
      const direction = transaction.direction === 'out' ? -1 : 1;
      adjustmentsByAccount.set(accountId, (adjustmentsByAccount.get(accountId) || 0) + direction * ignoredAmount);
      ignoredTransactions.push({ ...transaction, ignored_amount: ignoredAmount });
    }

    if (acceptedAmount > 0 || originalAmount === 0) {
      validTransactions.push(acceptedAmount === originalAmount
        ? transaction
        : { ...transaction, amount: acceptedAmount });
    }
  }

  const correctedAccounts = (accounts || []).map((account) => ({
    ...account,
    current_balance: Number((Number(account.current_balance || 0)
      - Number(adjustmentsByAccount.get(String(account.id)) || 0)).toFixed(2)),
  }));

  return {
    accounts: correctedAccounts,
    transactions: validTransactions,
    ignoredTransactions,
    ignoredAmount: ignoredTransactions.reduce((total, transaction) => total + Number(transaction.ignored_amount || 0), 0),
  };
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

export async function reconcileEggSaleTransactions(accounts = null) {
  const activeAccounts = accounts || await getActiveFinancialAccounts();
  const [{ data: eggSales, error: eggSalesError }, { data: existingTransactions, error: transactionsError }] = await Promise.all([
    supabase
      .from('egg_sales')
      .select('id, sale_date, customer_name, total_amount, payment_method, notes')
      .gt('total_amount', 0),
    supabase
      .from('financial_transactions')
      .select('reference_id')
      .eq('reference_type', 'egg_sale'),
  ]);

  if (eggSalesError) throw eggSalesError;
  if (transactionsError) throw transactionsError;

  const recordedSaleIds = new Set((existingTransactions || []).map((transaction) => String(transaction.reference_id)));
  const skippedSales = [];
  let reconciledCount = 0;

  for (const sale of eggSales || []) {
    if (recordedSaleIds.has(String(sale.id))) continue;
    if (!sale.payment_method) continue;

    const account = findAccountByPaymentMethod(activeAccounts, sale.payment_method);
    if (!account) {
      skippedSales.push(sale.id);
      continue;
    }

    await createFinancialTransaction({
      account_id: account.id,
      transaction_date: sale.sale_date,
      direction: 'in',
      transaction_type: 'sale_payment',
      amount: sale.total_amount,
      reference_type: 'egg_sale',
      reference_id: sale.id,
      description: `Recebimento de venda de ovos - ${sale.customer_name}`,
      notes: sale.notes || null,
    });

    recordedSaleIds.add(String(sale.id));
    reconciledCount += 1;
  }

  return { reconciledCount, skippedSales };
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
