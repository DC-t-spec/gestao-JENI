import { supabase } from '../core/supabase-client.js';
import { formatMoney, formatNumber, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';
import {
  createFinancialTransaction,
  findAccountByPaymentMethod,
  getActiveFinancialAccounts,
} from '../services/financial.service.js';

const today = () => new Date().toISOString().slice(0, 10);

export async function renderEggs() {
  setPageHeader('Ovos e poedeiras', 'Produção diária, stock, poedeiras e vendas');
  const [{ data: summary, error }, { data: production }, { data: sales }, { data: pendingSales }] = await Promise.all([
    supabase.from('egg_business_summary').select('*').single(),
    supabase.from('egg_production').select('*').order('production_date', { ascending: false }).limit(15),
    supabase.from('egg_sales').select('*').order('sale_date', { ascending: false }).limit(15),
    supabase.from('egg_sales').select('id, total_amount').is('payment_method', null),
  ]);
  if (error) {
    dom.pageContent.innerHTML = `<div class="card"><h3>Configuração necessária</h3><p>Execute a actualização SQL no Supabase.</p><div class="feedback error">${error.message}</div></div>`;
    return;
  }
  const eggAmountDue = (pendingSales || []).reduce((total, sale) => total + Number(sale.total_amount || 0), 0);
  dom.pageContent.innerHTML = `<div class="grid gap-14">
    <div class="dashboard-grid">
      <div class="card stat"><h4>Poedeiras vivas</h4><strong>${formatNumber(summary.layers_alive)}</strong></div>
      <div class="card stat"><h4>Ovos produzidos</h4><strong>${formatNumber(summary.eggs_produced)}</strong></div>
      <div class="card stat"><h4>Ovos vendidos</h4><strong>${formatNumber(summary.eggs_sold)}</strong></div>
      <div class="card stat"><h4>Stock de ovos</h4><strong>${formatNumber(summary.eggs_in_stock)}</strong></div>
      <div class="card stat"><h4>Receita de ovos</h4><strong>${formatMoney(summary.egg_revenue)}</strong></div>
      <div class="card stat"><h4>Ovos por receber</h4><strong>${formatMoney(eggAmountDue)}</strong></div>
    </div>
    <div class="split">
      <div class="card"><h3>Produção diária</h3><form id="egg-production-form" class="form-grid">
        <div class="field"><label>Data</label><input type="date" name="production_date" value="${today()}" required></div>
        <div class="field"><label>Quantidade de ovos</label><input type="number" name="egg_count" min="0" required></div>
        <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
        <button class="btn btn-primary">Guardar produção</button></form><div id="egg-production-feedback"></div></div>
      <div class="card"><h3>Movimento de poedeiras</h3><form id="layer-form" class="form-grid">
        <div class="field"><label>Tipo</label><select name="movement_type"><option value="entry">Entrada</option><option value="death">Mortalidade</option></select></div>
        <div class="field"><label>Data</label><input type="date" name="movement_date" value="${today()}" required></div>
        <div class="field"><label>Quantidade</label><input type="number" name="quantity" min="1" required></div>
        <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
        <button class="btn btn-primary">Guardar movimento</button></form><div id="layer-feedback"></div></div>
    </div>
    <div class="card"><h3>Venda de ovos</h3><form id="egg-sale-form" class="form-grid">
      <div class="field"><label>Data</label><input type="date" name="sale_date" value="${today()}" required></div>
      <div class="field"><label>Cliente</label><input name="customer_name" required></div>
      <div class="field"><label>Forma de venda</label><select name="sale_unit"><option value="unit">Unidade</option><option value="tray">Bandeja (30 ovos)</option></select></div>
      <div class="field"><label>Quantidade</label><input type="number" name="quantity" min="1" required></div>
      <div class="field"><label>Preço por unidade/bandeja</label><input type="number" name="unit_price" min="0" step="0.01" required></div>
      <div class="field"><label>Estado do pagamento</label><select name="payment_status" id="egg-payment-status"><option value="paid">Pago</option><option value="pending">Pendente — pagar depois</option></select></div>
      <div class="field"><label>Forma de pagamento</label><select name="payment_method" id="egg-payment-method"><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="bank_transfer">Transferência</option></select></div>
      <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
      <button class="btn btn-primary">Guardar venda</button></form><div id="egg-sale-feedback"></div></div>
    <div class="split">
      <div class="card"><h3>Produção recente</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Ovos</th><th>Observações</th></tr></thead><tbody>
      ${(production || []).map(r => `<tr><td>${r.production_date}</td><td>${r.egg_count}</td><td>${r.notes || '-'}</td></tr>`).join('') || '<tr><td colspan="3">Sem registos.</td></tr>'}</tbody></table></div></div>
      <div class="card"><h3>Vendas recentes</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Venda</th><th>Ovos</th><th>Total</th><th>Pagamento</th><th>Acção</th></tr></thead><tbody>
      ${(sales || []).map(r => `<tr><td>${r.sale_date}</td><td>${r.customer_name}</td><td>${r.quantity} ${r.sale_unit === 'tray' ? 'bandeja(s)' : 'unidade(s)'}</td><td>${r.egg_quantity}</td><td>${formatMoney(r.total_amount)}</td><td><span class="badge badge--${r.payment_method ? 'paid' : 'pending'}">${r.payment_method ? 'Pago' : 'Pendente'}</span></td><td>${r.payment_method ? '-' : `<button type="button" class="btn btn-secondary" data-action="register-egg-payment" data-sale-id="${r.id}">Registar pagamento</button>`}</td></tr>`).join('') || '<tr><td colspan="7">Sem registos.</td></tr>'}</tbody></table></div></div>
    </div></div>`;

  const paymentStatusField = document.querySelector('#egg-payment-status');
  const paymentMethodField = document.querySelector('#egg-payment-method');
  paymentStatusField.addEventListener('change', () => {
    paymentMethodField.disabled = paymentStatusField.value === 'pending';
  });

  document.querySelectorAll('[data-action="register-egg-payment"]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await openEggPaymentModal(button.dataset.saleId);
      } catch (paymentError) {
        showFeedback(document.querySelector('#egg-sale-feedback'), paymentError.message, 'error');
      }
    });
  });

  bind('#egg-production-form', '#egg-production-feedback', 'egg_production', fd => ({
    production_date: fd.get('production_date'), egg_count: Number(fd.get('egg_count')), notes: fd.get('notes') || null, created_by: getCurrentUserId(),
  }), 'Produção registada.');
  bind('#layer-form', '#layer-feedback', null, fd => ({
    table: fd.get('movement_type') === 'death' ? 'layer_mortality' : 'layer_entries',
    payload: { movement_date: fd.get('movement_date'), quantity: Number(fd.get('quantity')), notes: fd.get('notes') || null, created_by: getCurrentUserId() },
  }), 'Movimento registado.');
  document.querySelector('#egg-sale-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const quantity = Number(fd.get('quantity'));
    const eggQuantity = fd.get('sale_unit') === 'tray' ? quantity * 30 : quantity;
    const feedback = document.querySelector('#egg-sale-feedback');
    if (eggQuantity > Number(summary.eggs_in_stock)) return showFeedback(feedback, 'Quantidade superior ao stock disponível.', 'error');

    const totalAmount = Number((quantity * Number(fd.get('unit_price'))).toFixed(2));
    const paymentStatus = fd.get('payment_status') || 'paid';
    const paymentMethod = paymentStatus === 'pending' ? null : fd.get('payment_method');
    let financialAccount = null;

    if (totalAmount > 0 && paymentStatus !== 'pending') {
      try {
        const accounts = await getActiveFinancialAccounts();
        financialAccount = findAccountByPaymentMethod(accounts, paymentMethod);
      } catch (accountError) {
        return showFeedback(feedback, accountError.message, 'error');
      }

      if (!financialAccount) {
        return showFeedback(feedback, 'Não existe conta financeira activa para o método de pagamento seleccionado.', 'error');
      }
    }

    const { data: insertedSale, error: saleError } = await supabase.from('egg_sales').insert({
      sale_date: fd.get('sale_date'), customer_name: fd.get('customer_name'), sale_unit: fd.get('sale_unit'),
      quantity, egg_quantity: eggQuantity, unit_price: Number(fd.get('unit_price')),
      total_amount: totalAmount, payment_method: paymentMethod,
      notes: fd.get('notes') || null, created_by: getCurrentUserId(),
    }).select('id').single();
    if (saleError) return showFeedback(feedback, saleError.message, 'error');

    if (financialAccount) {
      try {
        await createFinancialTransaction({
          account_id: financialAccount.id,
          transaction_date: fd.get('sale_date'),
          direction: 'in',
          transaction_type: 'sale_payment',
          amount: totalAmount,
          reference_type: 'egg_sale',
          reference_id: insertedSale.id,
          description: `Recebimento de venda de ovos - ${fd.get('customer_name')}`,
          notes: fd.get('notes') || null,
        });
      } catch (transactionError) {
        console.error('Erro ao criar movimento financeiro da venda de ovos:', transactionError);
        return showFeedback(feedback, `A venda foi guardada, mas o movimento financeiro não foi registado: ${transactionError.message}`, 'error');
      }
    }

    await renderEggs();
  });
}

async function openEggPaymentModal(saleId) {
  const [{ data: sale, error: saleError }, accounts] = await Promise.all([
    supabase.from('egg_sales').select('*').eq('id', saleId).single(),
    getActiveFinancialAccounts(),
  ]);

  if (saleError) throw saleError;
  if (!sale) throw new Error('Venda de ovos não encontrada.');
  if (sale.payment_method) throw new Error('Esta venda de ovos já foi paga.');

  document.querySelector('#egg-payment-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'egg-payment-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card" style="width:min(560px,100%);">
      <div class="modal-card__header">
        <h3>Registar pagamento de ovos</h3>
        <button type="button" class="btn btn-secondary" data-close-egg-payment>Fechar</button>
      </div>
      <div class="modal-card__body">
        <div class="toolbar">
          <span class="badge">Cliente: <strong style="margin-left:6px;">${sale.customer_name}</strong></span>
          <span class="badge">Valor a receber: <strong style="margin-left:6px;">${formatMoney(sale.total_amount)}</strong></span>
        </div>
        <form id="egg-payment-form" class="form-grid">
          <div class="field"><label>Data do pagamento</label><input type="date" name="payment_date" value="${today()}" required></div>
          <div class="field"><label>Forma de pagamento</label><select name="payment_method" required><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="bank_transfer">Transferência</option></select></div>
          <div class="field full"><label>Observações</label><textarea name="payment_notes"></textarea></div>
          <div class="field full"><button type="submit" class="btn btn-primary">Confirmar pagamento</button></div>
        </form>
        <div id="egg-payment-feedback"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('[data-close-egg-payment]').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });

  const form = modal.querySelector('#egg-payment-form');
  const feedback = modal.querySelector('#egg-payment-feedback');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const paymentMethod = fd.get('payment_method');

    try {
      const account = findAccountByPaymentMethod(accounts, paymentMethod);
      if (!account) throw new Error('Não existe conta financeira activa para o método de pagamento seleccionado.');

      const { data: updatedSale, error: updateError } = await supabase
        .from('egg_sales')
        .update({ payment_method: paymentMethod })
        .eq('id', sale.id)
        .is('payment_method', null)
        .select('*')
        .single();

      if (updateError) throw updateError;
      if (!updatedSale) throw new Error('Esta venda de ovos já foi paga.');

      await createFinancialTransaction({
        account_id: account.id,
        transaction_date: fd.get('payment_date'),
        direction: 'in',
        transaction_type: 'sale_payment',
        amount: updatedSale.total_amount,
        reference_type: 'egg_sale',
        reference_id: updatedSale.id,
        description: `Recebimento de venda de ovos - ${updatedSale.customer_name}`,
        notes: fd.get('payment_notes') || updatedSale.notes || null,
      });

      modal.remove();
      await renderEggs();
    } catch (paymentError) {
      console.error('Erro ao registar pagamento de ovos:', paymentError);
      showFeedback(feedback, paymentError.message, 'error');
    }
  });
}

function bind(formSelector, feedbackSelector, table, makeData, success) {
  document.querySelector(formSelector).addEventListener('submit', async e => {
    e.preventDefault(); const feedback = document.querySelector(feedbackSelector); const result = makeData(new FormData(e.currentTarget));
    const { error } = await supabase.from(result.table || table).insert(result.payload || result);
    if (error) return showFeedback(feedback, error.message, 'error');
    showFeedback(feedback, success, 'success'); await renderEggs();
  });
}
