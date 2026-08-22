import { supabase } from '../core/supabase-client.js';
import { canAccessAdmin, formatMoney, formatNumber, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

const DEBT_DEPARTMENT = 'JENI FRANGOS';
const today = () => new Date().toISOString().slice(0, 10);

function getOutstandingAmount(debt) {
  return Number(Math.max(Number(debt.total_amount || 0) - Number(debt.paid_amount || 0), 0).toFixed(2));
}

function getDebtStatus(debt) {
  if (debt.status === 'cancelled') return { label: 'Cancelada', type: 'pending' };
  if (getOutstandingAmount(debt) <= 0) return { label: 'Paga', type: 'paid' };
  if (debt.due_date < today()) return { label: 'Vencida', type: 'pending' };
  if (Number(debt.paid_amount || 0) > 0) return { label: 'Parcial', type: 'partial' };
  return { label: 'Pendente', type: 'pending' };
}

export async function renderDebts() {
  setPageHeader('Dívidas', 'Registo de valores a receber e a pagar');

  if (!canAccessAdmin()) {
    dom.pageContent.innerHTML = '<div class="card"><h3>Acesso restrito</h3><p class="muted">Esta área é apenas para administradores.</p></div>';
    return;
  }

  const { data: debts, error } = await supabase
    .from('finance_obligations')
    .select('*')
    .eq('department', DEBT_DEPARTMENT)
    .order('due_date', { ascending: true });

  if (error) {
    dom.pageContent.innerHTML = `<div class="card"><h3>Não foi possível carregar as dívidas</h3><p>Confirme se o módulo financeiro está configurado no Supabase.</p><div class="feedback error">${error.message}</div></div>`;
    return;
  }

  const activeDebts = (debts || []).filter((debt) => !['paid', 'cancelled'].includes(debt.status) && getOutstandingAmount(debt) > 0);
  const totalReceivable = activeDebts.filter((debt) => debt.obligation_type === 'receivable').reduce((total, debt) => total + getOutstandingAmount(debt), 0);
  const totalPayable = activeDebts.filter((debt) => debt.obligation_type === 'payable').reduce((total, debt) => total + getOutstandingAmount(debt), 0);
  const overdueCount = activeDebts.filter((debt) => debt.due_date < today()).length;

  dom.pageContent.innerHTML = `
    <div class="grid gap-14">
      <div class="dashboard-grid">
        <div class="card stat"><h4>A receber</h4><strong>${formatMoney(totalReceivable)}</strong></div>
        <div class="card stat"><h4>A pagar</h4><strong>${formatMoney(totalPayable)}</strong></div>
        <div class="card stat"><h4>Dívidas vencidas</h4><strong>${formatNumber(overdueCount)}</strong></div>
        <div class="card stat"><h4>Registos activos</h4><strong>${formatNumber(activeDebts.length)}</strong></div>
      </div>

      <div class="card">
        <h3>Anotar dívida</h3>
        <form id="debt-form" class="form-grid">
          <div class="field"><label>Tipo de dívida</label><select name="obligation_type"><option value="receivable">Devem à JENI — a receber</option><option value="payable">JENI deve — a pagar</option></select></div>
          <div class="field"><label>Pessoa ou empresa</label><input name="entity_name" required placeholder="Nome do cliente, fornecedor ou credor"></div>
          <div class="field"><label>Descrição</label><input name="description" required placeholder="Motivo da dívida"></div>
          <div class="field"><label>Valor total</label><input type="number" name="total_amount" min="0.01" step="0.01" required></div>
          <div class="field"><label>Valor já pago</label><input type="number" name="paid_amount" min="0" step="0.01" value="0"></div>
          <div class="field"><label>Data do registo</label><input type="date" name="issue_date" value="${today()}" required></div>
          <div class="field"><label>Data de vencimento</label><input type="date" name="due_date" value="${today()}" required></div>
          <div class="field full"><label>Observações</label><textarea name="notes" placeholder="Contacto, acordo de pagamento ou outras informações"></textarea></div>
          <div class="field full"><button type="submit" class="btn btn-primary">Guardar dívida</button></div>
        </form>
        <div id="debt-feedback"></div>
      </div>

      <div class="card">
        <h3>Dívidas registadas</h3>
        <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Pessoa / empresa</th><th>Descrição</th><th>Total</th><th>Pago</th><th>Em falta</th><th>Vencimento</th><th>Estado</th><th>Acção</th></tr></thead><tbody>
          ${(debts || []).map((debt) => {
            const status = getDebtStatus(debt);
            const outstanding = getOutstandingAmount(debt);
            return `<tr><td>${debt.obligation_type === 'receivable' ? 'A receber' : 'A pagar'}</td><td>${debt.entity_name}</td><td>${debt.description}</td><td>${formatMoney(debt.total_amount)}</td><td>${formatMoney(debt.paid_amount || 0)}</td><td>${formatMoney(outstanding)}</td><td>${debt.due_date}</td><td><span class="badge badge--${status.type}">${status.label}</span></td><td>${outstanding > 0 && debt.status !== 'cancelled' ? `<button type="button" class="btn btn-secondary" data-action="register-debt-payment" data-debt-id="${debt.id}">Registar pagamento</button>` : '-'}</td></tr>`;
          }).join('') || '<tr><td colspan="9">Sem dívidas registadas.</td></tr>'}
        </tbody></table></div>
      </div>
    </div>
  `;

  document.querySelector('#debt-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const feedback = document.querySelector('#debt-feedback');
    const totalAmount = Number(fd.get('total_amount') || 0);
    const paidAmount = Number(fd.get('paid_amount') || 0);

    if (totalAmount <= 0) return showFeedback(feedback, 'O valor da dívida deve ser superior a zero.', 'error');
    if (paidAmount < 0 || paidAmount > totalAmount) return showFeedback(feedback, 'O valor pago não pode ser superior ao valor da dívida.', 'error');
    if (fd.get('due_date') < fd.get('issue_date')) return showFeedback(feedback, 'A data de vencimento não pode ser anterior à data do registo.', 'error');

    const status = paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';
    const { error: saveError } = await supabase.from('finance_obligations').insert({
      obligation_type: fd.get('obligation_type'),
      entity_name: String(fd.get('entity_name') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      total_amount: totalAmount,
      paid_amount: paidAmount,
      issue_date: fd.get('issue_date'),
      due_date: fd.get('due_date'),
      department: DEBT_DEPARTMENT,
      status,
      notes: String(fd.get('notes') || '').trim() || null,
      created_by: getCurrentUserId(),
    });

    if (saveError) return showFeedback(feedback, saveError.message, 'error');
    await renderDebts();
  });

  document.querySelectorAll('[data-action="register-debt-payment"]').forEach((button) => {
    button.addEventListener('click', () => openDebtPaymentModal((debts || []).find((debt) => debt.id === button.dataset.debtId)));
  });
}

function openDebtPaymentModal(debt) {
  if (!debt) return;
  document.querySelector('#debt-payment-modal')?.remove();

  const remaining = getOutstandingAmount(debt);
  const modal = document.createElement('div');
  modal.id = 'debt-payment-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="width:min(560px,100%);">
      <div class="modal-card__header"><h3>Registar pagamento da dívida</h3><button type="button" class="btn btn-secondary" data-close-debt-payment>Fechar</button></div>
      <div class="modal-card__body">
        <div class="toolbar"><span class="badge">${debt.entity_name}</span><span class="badge">Em falta: <strong style="margin-left:6px;">${formatMoney(remaining)}</strong></span></div>
        <form id="debt-payment-form" class="form-grid">
          <div class="field"><label>Valor do pagamento</label><input type="number" name="amount" min="0.01" max="${remaining}" step="0.01" required></div>
          <div class="field"><label>Data do pagamento</label><input type="date" name="payment_date" value="${today()}" required></div>
          <div class="field"><label>Forma de pagamento</label><select name="payment_method"><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="bank_transfer">Transferência</option></select></div>
          <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
          <div class="field full"><button type="submit" class="btn btn-primary">Guardar pagamento</button></div>
        </form>
        <div id="debt-payment-feedback"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('[data-close-debt-payment]').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });

  const form = modal.querySelector('#debt-payment-form');
  const feedback = modal.querySelector('#debt-payment-feedback');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const amount = Number(fd.get('amount') || 0);
    if (amount <= 0 || amount > remaining) return showFeedback(feedback, 'O pagamento deve ser superior a zero e não pode ultrapassar a dívida.', 'error');

    const { error: paymentError } = await supabase.from('finance_payments').insert({
      obligation_id: debt.id,
      payment_date: fd.get('payment_date'),
      amount,
      payment_method: fd.get('payment_method'),
      notes: fd.get('notes') || null,
      created_by: getCurrentUserId(),
    });
    if (paymentError) return showFeedback(feedback, paymentError.message, 'error');

    const updatedPaidAmount = Number((Number(debt.paid_amount || 0) + amount).toFixed(2));
    const status = updatedPaidAmount >= Number(debt.total_amount) ? 'paid' : 'partial';
    const { error: updateError } = await supabase.from('finance_obligations').update({ paid_amount: updatedPaidAmount, status }).eq('id', debt.id);
    if (updateError) return showFeedback(feedback, updateError.message, 'error');

    modal.remove();
    await renderDebts();
  });
}
