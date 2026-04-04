import { supabase } from '../core/supabase-client.js';
import { batchOptions, formatMoney, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

import {
  getRecentSales,
  getSaleById,
  getSalePayments,
  createSalePayment,
} from '../core/state.js';

export async function renderSales() {
  setPageHeader('Vendas', 'Registo de vendas com controlo de pagamento');

  const { data: rows } = await supabase
    .from('sales')
    .select('*')
    .order('sale_date', { ascending: false })
    .limit(20);

  dom.pageContent.innerHTML = `
    <div class="split">
      <div class="card">
        <h3>Nova venda</h3>
        <form id="sales-form" class="form-grid">
          <div class="field">
            <label>Data da venda</label>
            <input type="date" name="sale_date" required />
          </div>

          <div class="field">
            <label>Lote</label>
            <select name="batch_id">${batchOptions()}</select>
          </div>

          <div class="field">
            <label>Cliente</label>
            <input type="text" name="customer_name" required />
          </div>

          <div class="field">
            <label>Quantidade</label>
            <input type="number" step="0.01" name="quantity" required />
          </div>

          <div class="field">
            <label>Peso total</label>
            <input type="number" step="0.01" name="total_weight" />
          </div>

          <div class="field">
            <label>Preço unitário</label>
            <input type="number" step="0.01" name="unit_price" required />
          </div>

          <div class="field">
            <label>Aplicar IVA</label>
            <select name="apply_vat" id="apply_vat">
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </div>

          <div class="field">
            <label>Taxa de IVA (%)</label>
            <input type="number" step="0.01" name="vat_rate" value="16" />
          </div>

          <div class="field">
            <label>Forma de pagamento</label>
            <select name="payment_method">
              <option value="">Selecionar</option>
              <option value="cash">Dinheiro</option>
              <option value="mpesa">M-Pesa</option>
              <option value="emola">e-Mola</option>
              <option value="bank_transfer">Transferência</option>
              <option value="card">Cartão</option>
              <option value="other">Outro</option>
            </select>
          </div>

          <div class="field">
            <label>Estado do pagamento</label>
            <select name="payment_status" id="payment_status">
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="partial">Parcial</option>
            </select>
          </div>

          <div class="field">
            <label>Valor pago no momento</label>
            <input type="number" step="0.01" name="amount_paid" id="amount_paid" value="0" />
          </div>

          <div class="field">
            <label>Data limite de pagamento</label>
            <input type="date" name="due_date" id="due_date" />
          </div>

          <div class="field">
            <label>Contacto do cliente</label>
            <input type="text" name="customer_contact" />
          </div>

          <div class="field full">
            <label>Observações</label>
            <textarea name="notes"></textarea>
          </div>

          <div class="field full">
            <div id="sales-preview" class="preview-box"></div>
          </div>

          <div class="field full">
            <button class="btn btn-primary" type="submit">Guardar venda</button>
          </div>
        </form>

        <div id="sales-feedback"></div>
      </div>

      <div class="card">
        <h3>Últimas vendas</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Qtd</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Dívida</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${(rows || []).map((row) => `
                <tr>
                  <td>${row.sale_date || ''}</td>
                  <td>${row.customer_name || ''}</td>
                  <td>${row.quantity || ''}</td>
                  <td>${formatMoney(row.total_amount || 0)}</td>
                  <td>${formatMoney(row.amount_paid || 0)}</td>
                  <td>${formatMoney(row.amount_due || 0)}</td>
                  <td>${row.payment_status || ''}</td>
                </tr>
              `).join('') || '<tr><td colspan="7">Sem vendas registadas.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const form = document.querySelector('#sales-form');
  const preview = document.querySelector('#sales-preview');
  const paymentStatusField = document.querySelector('#payment_status');
  const amountPaidField = document.querySelector('#amount_paid');
  const dueDateField = document.querySelector('#due_date');

  function updateSalesPreview() {
    const quantity = Number(form.quantity.value || 0);
    const unitPrice = Number(form.unit_price.value || 0);
    const applyVat = form.apply_vat.value === 'true';
    const vatRate = Number(form.vat_rate.value || 0);
    const paymentStatus = paymentStatusField.value;

    const subtotal = Number((quantity * unitPrice).toFixed(2));
    const vatAmount = applyVat ? Number(((subtotal * vatRate) / 100).toFixed(2)) : 0;
    const total = Number((subtotal + vatAmount).toFixed(2));

    let amountPaid = Number(amountPaidField.value || 0);

    if (paymentStatus === 'paid') {
      amountPaid = total;
      amountPaidField.value = total.toFixed(2);
      dueDateField.disabled = true;
      dueDateField.value = '';
    } else if (paymentStatus === 'pending') {
      amountPaid = 0;
      amountPaidField.value = '0.00';
      dueDateField.disabled = false;
    } else {
      dueDateField.disabled = false;
    }

    const amountDue = Number(Math.max(total - amountPaid, 0).toFixed(2));

    preview.innerHTML = `
      <div class="toolbar">
        <span class="badge">Base tributável: <strong style="margin-left:6px;">${formatMoney(subtotal)}</strong></span>
        <span class="badge">IVA: <strong style="margin-left:6px;">${formatMoney(vatAmount)}</strong></span>
        <span class="badge">Total: <strong style="margin-left:6px;">${formatMoney(total)}</strong></span>
        <span class="badge">Pago: <strong style="margin-left:6px;">${formatMoney(amountPaid)}</strong></span>
        <span class="badge">Dívida: <strong style="margin-left:6px;">${formatMoney(amountDue)}</strong></span>
      </div>
    `;
  }

  form.addEventListener('input', updateSalesPreview);
  form.addEventListener('change', updateSalesPreview);
  updateSalesPreview();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fd = new FormData(form);

    const quantity = Number(fd.get('quantity'));
    const unitPrice = Number(fd.get('unit_price'));
    const applyVat = fd.get('apply_vat') === 'true';
    const vatRate = applyVat ? Number(fd.get('vat_rate') || 0) : 0;

    const subtotal = Number((quantity * unitPrice).toFixed(2));
    const vatAmount = applyVat ? Number(((subtotal * vatRate) / 100).toFixed(2)) : 0;
    const totalAmount = Number((subtotal + vatAmount).toFixed(2));

    const paymentStatus = String(fd.get('payment_status'));
    let amountPaid = Number(fd.get('amount_paid') || 0);

    if (paymentStatus === 'paid') {
      amountPaid = totalAmount;
    }

    if (paymentStatus === 'pending') {
      amountPaid = 0;
    }

    const amountDue = Number(Math.max(totalAmount - amountPaid, 0).toFixed(2));

    const payload = {
      sale_date: fd.get('sale_date'),
      batch_id: fd.get('batch_id') || null,
      customer_name: String(fd.get('customer_name')).trim(),
      quantity,
      total_weight: fd.get('total_weight') ? Number(fd.get('total_weight')) : null,
      unit_price: unitPrice,
      apply_vat: applyVat,
      vat_rate: vatRate,
      payment_method: fd.get('payment_method') || null,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      amount_due: amountDue,
      due_date: fd.get('due_date') || null,
      customer_contact: String(fd.get('customer_contact') || '').trim() || null,
      notes: String(fd.get('notes') || '').trim() || null,
      created_by: getCurrentUserId(),
      updated_by: getCurrentUserId(),
      subtotal_amount: 0,
      vat_amount: 0,
      total_amount: 0,
    };

    const { error } = await supabase.from('sales').insert(payload);
    const feedback = document.querySelector('#sales-feedback');

    if (error) {
      console.error('Erro ao guardar venda:', error);
      return showFeedback(feedback, `${error.message} ${error.details || ''}`, 'error');
    }

    showFeedback(feedback, 'Venda registada com sucesso.', 'success');
    await renderSales();
  });
}
