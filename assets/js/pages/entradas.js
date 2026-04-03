import { supabase } from '../core/supabase-client.js';
import { batchNameById, batchOptions, formatMoney, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

export async function renderBirdEntries() {
  setPageHeader('Entradas de pintos', 'Registo de entrada de aves por lote');

  const { data: rows } = await supabase.from('bird_entries').select('*').order('entry_date', { ascending: false }).limit(20);

  dom.pageContent.innerHTML = `
    <div class="split">
      <div class="card">
        <h3>Nova entrada</h3>
        <form id="entry-form" class="form-grid">
          <div class="field"><label>Data</label><input type="date" name="entry_date" required /></div>
          <div class="field"><label>Lote</label><select name="batch_id" required>${batchOptions({ required: true })}</select></div>
          <div class="field"><label>Quantidade</label><input type="number" step="0.01" name="quantity" required /></div>
          <div class="field"><label>Custo unitário</label><input type="number" step="0.01" name="unit_cost" /></div>
          <div class="field"><label>Fornecedor</label><input type="text" name="supplier_name" /></div>
          <div class="field"><label>Origem</label><input type="text" name="source_type" value="purchase" /></div>
          <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
          <div class="field full"><button class="btn btn-primary" type="submit">Guardar entrada</button></div>
        </form>
        <div id="entry-feedback"></div>
      </div>

      <div class="card">
        <h3>Últimas entradas</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Lote</th><th>Qtd</th><th>Custo un.</th><th>Total</th></tr></thead>
            <tbody>
              ${(rows || []).map((row) => `
                <tr><td>${row.entry_date || ''}</td><td>${batchNameById(row.batch_id)}</td><td>${row.quantity || ''}</td><td>${formatMoney(row.unit_cost || 0)}</td><td>${formatMoney(row.total_amount || 0)}</td></tr>
              `).join('') || '<tr><td colspan="5">Sem entradas registadas.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  document.querySelector('#entry-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    const payload = {
      entry_date: fd.get('entry_date'),
      batch_id: fd.get('batch_id'),
      quantity: Number(fd.get('quantity')),
      unit_cost: Number(fd.get('unit_cost') || 0),
      supplier_name: String(fd.get('supplier_name') || '').trim() || null,
      source_type: String(fd.get('source_type') || 'purchase').trim(),
      notes: String(fd.get('notes') || '').trim() || null,
      created_by: getCurrentUserId(),
      updated_by: getCurrentUserId(),
    };

    const { error } = await supabase.from('bird_entries').insert(payload);
    const feedback = document.querySelector('#entry-feedback');
    if (error) return showFeedback(feedback, error.message, 'error');
    showFeedback(feedback, 'Entrada registada com sucesso.', 'success');
    await renderBirdEntries();
  });
}
