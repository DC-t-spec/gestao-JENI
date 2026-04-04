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


function getPaymentStatusLabel(status) {
  switch (status) {
    case 'paid':
      return 'Pago';
    case 'partial':
      return 'Parcial';
    case 'pending':
    default:
      return 'Pendente';
  }
}

function getPaymentStatusBadge(status) {
  const label = getPaymentStatusLabel(status);
  const safeStatus = status || 'pending';
  return `<span class="badge badge--${safeStatus}">${label}</span>`;
}

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
    <th>Ações</th>
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
      <td>${getPaymentStatusBadge(row.payment_status)}</td>
      <td>
        ${Number(row.amount_due || 0) > 0 ? `
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="register-payment"
            data-sale-id="${row.id}"
          >
            Registar pagamento
          </button>
        ` : '<span class="muted">Sem ação</span>'}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8">Sem vendas registadas.</td></tr>'}
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

  document.querySelectorAll('[data-action="register-payment"]').forEach((button) => {
  button.addEventListener('click', async () => {
    const saleId = button.dataset.saleId;

    try {
      await openRegisterPaymentModal(saleId);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Erro ao abrir pagamento.');
    }
  });
});

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
} else if (paymentStatus === 'pending') {
  amountPaid = 0;
} else {
  amountPaid = Math.min(Math.max(amountPaid, 0), totalAmount);
}

const amountDue = Number(Math.max(totalAmount - amountPaid, 0).toFixed(2));

let normalizedPaymentStatus = paymentStatus;

if (amountDue <= 0) {
  normalizedPaymentStatus = 'paid';
} else if (amountPaid > 0) {
  normalizedPaymentStatus = 'partial';
} else {
  normalizedPaymentStatus = 'pending';
}
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
     payment_status: normalizedPaymentStatus,
      amount_paid: amountPaid,
      amount_due: amountDue,
      due_date: fd.get('due_date') || null,
      customer_contact: String(fd.get('customer_contact') || '').trim() || null,
      notes: String(fd.get('notes') || '').trim() || null,
      created_by: getCurrentUserId(),
      updated_by: getCurrentUserId(),
     subtotal_amount: subtotal,
vat_amount: vatAmount,
total_amount: totalAmount,
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

async function openRegisterPaymentModal(saleId) {
  const sale = await getSaleById(saleId);

  if (!sale) {
    throw new Error('Venda não encontrada.');
  }

  const existingModal = document.querySelector('#sale-payment-modal');
  if (existingModal) existingModal.remove();

  const today = new Date().toISOString().split('T')[0];

  const modal = document.createElement('div');
  modal.id = 'sale-payment-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-card__header">
        <h3>Registar pagamento</h3>
        <button type="button" class="btn btn-secondary" id="close-sale-payment-modal">Fechar</button>
      </div>

      <div class="modal-card__body">
        <div class="toolbar">
          <span class="badge">Cliente: <strong style="margin-left:6px;">${sale.customer_name || '-'}</strong></span>
          <span class="badge">Total: <strong style="margin-left:6px;">${formatMoney(sale.total_amount || 0)}</strong></span>
          <span class="badge">Pago: <strong style="margin-left:6px;">${formatMoney(sale.amount_paid || 0)}</strong></span>
          <span class="badge">Dívida: <strong style="margin-left:6px;">${formatMoney(sale.amount_due || 0)}</strong></span>
        </div>

        <form id="sale-payment-form" class="form-grid">
          <input type="hidden" name="sale_id" value="${sale.id}" />

          <div class="field">
            <label>Data do pagamento</label>
            <input type="date" name="payment_date" value="${today}" required />
          </div>

          <div class="field">
            <label>Valor pago</label>
            <input
              type="number"
              name="amount_paid"
              min="0.01"
              max="${Number(sale.amount_due || 0)}"
              step="0.01"
              required
            />
          </div>

          <div class="field">
            <label>Método de pagamento</label>
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

          <div class="field full">
            <label>Observações</label>
            <textarea name="notes"></textarea>
          </div>

          <div class="field full">
            <button type="submit" class="btn btn-primary">Guardar pagamento</button>
          </div>
        </form>

        <div id="sale-payment-feedback"></div>

        <div class="card" style="margin-top:16px;">
          <h4>Histórico de recebimentos</h4>
          <div id="sale-payment-history">Carregando...</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.querySelector('#close-sale-payment-modal')?.addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.remove();
    }
  });

  await renderSalePaymentHistory(sale.id);

  const paymentForm = document.querySelector('#sale-payment-form');
  const feedback = document.querySelector('#sale-payment-feedback');

  paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fd = new FormData(paymentForm);

    try {
      await createSalePayment({
        saleId: fd.get('sale_id'),
        paymentDate: fd.get('payment_date'),
        amountPaid: fd.get('amount_paid'),
        paymentMethod: fd.get('payment_method'),
        notes: fd.get('notes'),
      });

      showFeedback(feedback, 'Pagamento registado com sucesso.', 'success');

      const updatedSale = await getSaleById(sale.id);

      await renderSalePaymentHistory(sale.id);
      await renderSales();

      if (Number(updatedSale.amount_due || 0) <= 0) {
        const currentModal = document.querySelector('#sale-payment-modal');
        if (currentModal) currentModal.remove();
      }
    } catch (error) {
      console.error(error);
      showFeedback(
        feedback,
        error.message || 'Erro ao registar pagamento.',
        'error'
      );
    }
  });
}

async function renderSalePaymentHistory(saleId) {
  const container = document.querySelector('#sale-payment-history');
  if (!container) return;

  try {
    const payments = await getSalePayments(saleId);

    if (!payments.length) {
      container.innerHTML = `<p>Sem recebimentos registados.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Valor</th>
              <th>Método</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map((payment) => `
              <tr>
                <td>${payment.payment_date || ''}</td>
                <td>${formatMoney(payment.amount_paid || 0)}</td>
                <td>${payment.payment_method || ''}</td>
                <td>${payment.notes || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error(error);
    container.innerHTML = `<p>Erro ao carregar histórico de pagamentos.</p>`;
  }
}
