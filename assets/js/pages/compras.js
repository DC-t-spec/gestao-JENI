import { supabase } from '../supabase-client.js';

export async function renderComprasPage() {
  document.querySelector('#page-title').textContent = 'Compras';
  document.querySelector('#page-subtitle').textContent = 'Registo de compras';

  const app = document.querySelector('#app');

  app.innerHTML = `
    <div class="card form-card">
      <h2>Nova compra</h2>
      <form id="purchase-form" class="form-grid">
        <input type="date" name="purchase_date" required />
        <input type="text" name="item_name" placeholder="Item comprado" required />
        <input type="text" name="category" placeholder="Categoria" required />
        <input type="number" step="0.01" name="quantity" placeholder="Quantidade" required />
        <input type="text" name="unit" placeholder="Unidade" />
        <input type="number" step="0.01" name="unit_price" placeholder="Preço unitário" required />
        <input type="text" name="supplier_name" placeholder="Fornecedor" />
        <input type="text" name="purchase_place" placeholder="Onde comprou" />
        <textarea name="notes" placeholder="Observações"></textarea>
        <button type="submit" class="btn btn-primary">Guardar compra</button>
      </form>
      <div id="purchase-feedback"></div>
    </div>
  `;

  const form = document.querySelector('#purchase-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);

    const quantity = Number(formData.get('quantity'));
    const unitPrice = Number(formData.get('unit_price'));
    const totalAmount = quantity * unitPrice;

    const { error } = await supabase.from('purchases').insert({
      purchase_date: formData.get('purchase_date'),
      item_name: formData.get('item_name'),
      category: formData.get('category'),
      quantity,
      unit: formData.get('unit'),
      unit_price: unitPrice,
      total_amount: totalAmount,
      supplier_name: formData.get('supplier_name'),
      purchase_place: formData.get('purchase_place'),
      notes: formData.get('notes'),
      created_by: (await supabase.auth.getUser()).data.user.id,
    });

    const feedback = document.querySelector('#purchase-feedback');
    if (error) {
      feedback.innerHTML = `<p class="feedback error">${error.message}</p>`;
      return;
    }

    feedback.innerHTML = `<p class="feedback success">Compra registada com sucesso.</p>`;
    form.reset();
  });
}
