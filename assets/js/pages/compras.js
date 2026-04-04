import { supabase } from '../core/supabase-client.js';
import { fetchBatches } from '../core/data.js';
import { batchOptions, formatMoney, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

export async function renderPurchases() {
  setPageHeader('Compras', 'Registo de compras e despesas');

  // carregar lotes antes de montar o form
  await fetchBatches();

  const { data: rows, error: rowsError } = await supabase
    .from('purchases')
    .select('*')
    .order('purchase_date', { ascending: false })
    .limit(20);

  if (rowsError) {
    console.error('Erro ao buscar compras:', rowsError);
  }

  dom.pageContent.innerHTML = `
    <div class="split">
      <div class="card">
        <h3>Nova compra</h3>
        <form id="purchase-form" class="form-grid">
          <div class="field">
            <label>Data da compra</label>
            <input type="date" name="purchase_date" required />
          </div>

          <div class="field">
            <label>Lote</label>
            <select name="batch_id" required>
              ${batchOptions()}
            </select>
          </div>

          <div class="field">
            <label>Item comprado</label>
            <input type="text" name="item_name" required />
          </div>

          <div class="field">
            <label>Categoria</label>
            <input type="text" name="category" required placeholder="Ex: ração, vacina, transporte" />
          </div>

          <div class="field">
            <label>Quantidade</label>
            <input type="number" step="0.01" name="quantity" required />
          </div>

          <div class="field">
            <label>Unidade</label>
            <input type="text" name="unit" placeholder="kg, saco, unidade" />
          </div>

          <div class="field">
            <label>Preço unitário</label>
            <input type="number" step="0.01" name="unit_price" required />
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

          <div class="field">
            <label>Fornecedor</label>
            <input type="text" name="supplier_name" />
          </div>

          <div class="field">
            <label>Onde comprou</label>
            <input type="text" name="purchase_place" />
          </div>

          <div class="field full">
            <label>Observações</label>
            <textarea name="notes"></textarea>
          </div>

          <div class="field full">
            <button class="btn btn-primary" type="submit">Guardar compra</button>
          </div>
        </form>

        <div id="purchase-feedback"></div>
      </div>

      <div class="card">
        <h3>Últimas compras</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Item</th>
                <th>Categoria</th>
                <th>Qtd</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${
                (rows || []).length
                  ? rows.map((row) => `
                    <tr>
                      <td>${row.purchase_date || ''}</td>
                      <td>${row.item_name || ''}</td>
                      <td>${row.category || ''}</td>
                      <td>${row.quantity || ''}</td>
                      <td>${formatMoney(row.total_amount)}</td>
                    </tr>
                  `).join('')
                  : '<tr><td colspan="5">Sem compras registadas.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  document.querySelector('#purchase-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const fd = new FormData(event.currentTarget);
    const quantity = Number(fd.get('quantity'));
    const unitPrice = Number(fd.get('unit_price'));
    const feedback = document.querySelector('#purchase-feedback');

    console.log('batch_id selecionado:', fd.get('batch_id'));

    const payload = {
      purchase_date: fd.get('purchase_date'),
      batch_id: fd.get('batch_id') || null,
      item_name: String(fd.get('item_name')).trim(),
      category: String(fd.get('category')).trim(),
      quantity,
      unit: String(fd.get('unit') || '').trim() || null,
      unit_price: unitPrice,
      total_amount: Number((quantity * unitPrice).toFixed(2)),
      supplier_name: String(fd.get('supplier_name') || '').trim() || null,
      purchase_place: String(fd.get('purchase_place') || '').trim() || null,
      payment_method: fd.get('payment_method') || null,
      notes: String(fd.get('notes') || '').trim() || null,
      created_by: getCurrentUserId(),
      updated_by: getCurrentUserId(),
    };

    const { error } = await supabase.from('purchases').insert(payload);

    if (error) {
      console.error('Erro ao guardar compra:', error);
      return showFeedback(feedback, error.message, 'error');
    }

    showFeedback(feedback, 'Compra registada com sucesso.', 'success');
    event.currentTarget.reset();
    await renderPurchases();
  });
}
