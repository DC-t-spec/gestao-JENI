import { supabase } from '../supabase-client.js';

export async function renderVendasPage() {
  document.querySelector('#page-title').textContent = 'Vendas';
  document.querySelector('#page-subtitle').textContent = 'Registo de vendas';

  const app = document.querySelector('#app');

  app.innerHTML = `
    <div class="card form-card">
      <h2>Nova venda</h2>
      <form id="sales-form" class="form-grid">
        <input type="date" name="sale_date" required />
        <input type="text" name="customer_name" placeholder="Cliente" required />
        <input type="number" step="0.01" name="quantity" placeholder="Quantidade" required />
        <input type="number" step="0.01" name="unit_price" placeholder="Preço unitário" required />
        <label class="checkbox-row">
          <input type="checkbox" name="apply_vat" /> Aplicar IVA
        </label>
        <input type="number" step="0.01" name="vat_rate" placeholder="Taxa IVA (%)" value="16" />
        <input type="text" name="customer_contact" placeholder="Contacto do cliente" />
        <textarea name="notes" placeholder="Observações"></textarea>
        <button type="submit" class="btn btn-primary">Guardar venda</button>
      </form>
      <div id="sales-preview"></div>
      <div id="sales-feedback"></div>
    </div>
  `;

  const form = document.querySelector('#sales-form');
  const preview = document.querySelector('#sales-preview');

  function updatePreview() {
    const quantity = Number(form.quantity.value || 0);
    const unitPrice = Number(form.unit_price.value || 0);
    const applyVat = form.apply_vat.checked;
    const vatRate = Number(form.vat_rate.value || 0);

    const subtotal = quantity * unitPrice;
    const vatAmount = applyVat ? (subtotal * vatRate) / 100 : 0;
    const total = subtotal + vatAmount;

    preview.innerHTML = `
      <div class="preview-box">
        <p>Subtotal: <strong>${subtotal.toFixed(2)} MZN</strong></p>
        <p>IVA: <strong>${vatAmount.toFixed(2)} MZN</strong></p>
        <p>Total: <strong>${total.toFixed(2)} MZN</strong></p>
      </div>
    `;
  }

  form.addEventListener('input', updatePreview);
  updatePreview();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const { error } = await supabase.from('sales').insert({
      sale_date: formData.get('sale_date'),
      customer_name: formData.get('customer_name'),
      quantity: Number(formData.get('quantity')),
      unit_price: Number(formData.get('unit_price')),
      apply_vat: form.apply_vat.checked,
      vat_rate: form.apply_vat.checked ? Number(formData.get('vat_rate')) : 0,
      customer_contact: formData.get('customer_contact'),
      notes: formData.get('notes'),
      created_by: (await supabase.auth.getUser()).data.user.id,
      subtotal_amount: 0,
      vat_amount: 0,
      total_amount: 0
    });

    const feedback = document.querySelector('#sales-feedback');
    if (error) {
      feedback.innerHTML = `<p class="feedback error">${error.message}</p>`;
      return;
}
