import { state } from './state.js';

export function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} MZN`;
}

export function formatNumber(value) {
  return Number(value || 0).toFixed(0);
}

export function getCurrentUserId() {
  return state.currentUser?.id || null;
}

export function canAccessAdmin() {
  return state.profile?.role === 'admin';
}

export function batchNameById(batchId) {
  return state.batches.find((batch) => batch.id === batchId)?.name || '';
}

export function batchOptions({ includeEmpty = true, required = false } = {}) {
  const empty = includeEmpty ? `<option value="">${required ? 'Selecionar lote' : 'Sem lote'}</option>` : '';
  const options = state.batches.map((batch) => `<option value="${batch.id}">${batch.name}</option>`).join('');
  return empty + options;
}
