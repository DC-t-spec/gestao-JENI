import { supabase } from '../core/supabase-client.js';
import { batchOptions, formatMoney, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

export async function renderSales() {
  setPageHeader('Vendas', 'Registo de vendas com suporte a IVA');

  const { data: rows } = await supabase.from('sales_financial_report').select('*').order('sale_date', { ascending: false }).limit(20);

  dom.pageContent.innerHTML = `
    <div class="split">
      <div class="card">
        <h3>Nova venda</h3>
        <form id="sales-form" class="form-grid">
          <div class="field"><label>Data da venda</label><input type="date" name="sale_date" required /></div>
          <div class="field"><label>Lote</label><select name="batch_id">${batchOptions()}</select></div>
          <div class="field"><label>Cliente</label><input type="text" name="customer_name" required /></div>
          <div class="field"><label>Quantidade</label><input type="number" step="0.01" name="quantity" required /></div>
          <div class="field"><label>Peso total</label><input type="number" step="0.01" name="total_weight" /></div>
          <div class="field"><label>Preço unitário</label><input type="number" step="0.01" name="unit_price" required /></div>
          <div class="field checkbox-line"><input type="checkbox" name="apply_vat" id="apply_vat" /><label for="apply_vat">Aplicar IVA</label></div>
          <div class="field"><label>Taxa de IVA (%)</label><input type="number" step="0.01" name="vat_rate" value="16" /></div>
          <div class="field"><label>Forma de pagamento</label>
            <select name="payment_method">
              <option value="">Selecionar</option><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option>
              <option value="bank_transfer">Transferência</option><option value="card">Cartão</option><option value="other">Outro</option>
            </select>
          </div>
          <div class="field"><label>Contacto do cliente</label><input type="text" name="customer_contact" /></div>
          <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
          <div class="field full"><div id="sales-preview" class="preview-box"></div></div>
          <div class="field full"><button class="btn btn-primary" type="submit">Guardar venda</button></div>
        </form>
        <div id="sales-feedback"></div>
      </div>

      <div class="card">
        <h3>Últimas vendas</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Cliente</th><th>Qtd</th><th>Base</th><th>IVA</th><th>Total</th></tr></thead>
            <tbody>
              ${(rows || []).map((row) => `
                <tr><td>${row.sale_date || ''}</td><td>${row.customer_name || ''}</td><td>${row.quantity || ''}</td><td>${formatMoney(row.taxable_base || 0)}</td><td>${formatMoney(row.vat_amount || 0)}</td><td><strong>${formatMoney(row.total_amount || 0)}</strong></td></tr>
              `).join('') || '<tr><td colspan="6">Sem vendas registadas.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  const form = document.querySelector('#sales-form');
  const preview = document.querySelector('#sales-preview');

  function updatePreview() {
    const quantity = Number(form.quantity.value || 0);
    const unitPrice = Number(form.unit_price.value || 0);
    const applyVat = form.apply_vat.checked;
    const vatRate = Number(form.vat_rate.value || 0);
    const subtotal = Number((quantity * unitPrice).toFixed(2));
    const vatAmount = applyVat ? Number(((subtotal * vatRate) / 100).toFixed(2)) : 0;
    const total = Number((subtotal + vatAmount).toFixed(2));
    preview.innerHTML = `<div class="toolbar"><span class="badge">Base tributável: <strong style="margin-left:6px;">${formatMoney(subtotal)}</strong></span><span class="badge">IVA: <strong style="margin-left:6px;">${formatMoney(vatAmount)}</strong></span><span class="badge">Total: <strong style="margin-left:6px;">${formatMoney(total)}</strong></span></div>`;
  }

  form.addEventListener('input', updatePreview);
  updatePreview();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const payload = {
      sale_date: fd.get('sale_date'),
      batch_id: fd.get('batch_id') || null,
      customer_name: String(fd.get('customer_name')).trim(),
      quantity: Number(fd.get('quantity')),
      total_weight: fd.get('total_weight') ? Number(fd.get('total_weight')) : null,
      unit_price: Number(fd.get('unit_price')),
      apply_vat: form.apply_vat.checked,
      vat_rate: form.apply_vat.checked ? Number(fd.get('vat_rate') || 0) : 0,
      payment_method: fd.get('payment_method') || null,
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
    if (error) return showFeedback(feedback, error.message, 'error');
    showFeedback(feedback, 'Venda registada com sucesso.', 'success');
    await renderSales();
  });
}
