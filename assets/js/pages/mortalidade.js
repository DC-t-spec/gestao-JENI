import { supabase } from '../core/supabase-client.js';
import { batchNameById, batchOptions, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

export async function renderMortality() {
  setPageHeader('Mortalidade', 'Registo de pintos/frangos mortos');

  const { data: rows } = await supabase.from('mortality_logs').select('*').order('log_date', { ascending: false }).limit(20);

  dom.pageContent.innerHTML = `
    <div class="split">
      <div class="card">
        <h3>Novo registo de mortalidade</h3>
        <form id="mortality-form" class="form-grid">
          <div class="field"><label>Data</label><input type="date" name="log_date" required /></div>
          <div class="field"><label>Lote</label><select name="batch_id" required>${batchOptions({ required: true })}</select></div>
          <div class="field"><label>Quantidade morta</label><input type="number" step="0.01" name="quantity_dead" required /></div>
          <div class="field"><label>Idade em dias</label><input type="number" name="age_days" /></div>
          <div class="field full"><label>Causa provável</label><input type="text" name="probable_cause" /></div>
          <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
          <div class="field full"><button class="btn btn-primary" type="submit">Guardar registo</button></div>
        </form>
        <div id="mortality-feedback"></div>
      </div>

      <div class="card">
        <h3>Últimos registos</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Lote</th><th>Qtd morta</th><th>Idade</th><th>Causa</th></tr></thead>
            <tbody>
              ${(rows || []).map((row) => `
                <tr><td>${row.log_date || ''}</td><td>${batchNameById(row.batch_id)}</td><td>${row.quantity_dead || ''}</td><td>${row.age_days ?? ''}</td><td>${row.probable_cause || ''}</td></tr>
              `).join('') || '<tr><td colspan="5">Sem registos de mortalidade.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  document.querySelector('#mortality-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const payload = {
      log_date: fd.get('log_date'),
      batch_id: fd.get('batch_id'),
      quantity_dead: Number(fd.get('quantity_dead')),
      age_days: fd.get('age_days') ? Number(fd.get('age_days')) : null,
      probable_cause: String(fd.get('probable_cause') || '').trim() || null,
      notes: String(fd.get('notes') || '').trim() || null,
      created_by: getCurrentUserId(),
      updated_by: getCurrentUserId(),
    };

    const { error } = await supabase.from('mortality_logs').insert(payload);
    const feedback = document.querySelector('#mortality-feedback');
    if (error) return showFeedback(feedback, error.message, 'error');
    showFeedback(feedback, 'Mortalidade registada com sucesso.', 'success');
    await renderMortality();
  });
}
