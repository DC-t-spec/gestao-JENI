import { supabase } from '../supabase-client.js';

export async function renderMortalidadePage() {
  document.querySelector('#page-title').textContent = 'Mortalidade';
  document.querySelector('#page-subtitle').textContent = 'Registo de aves mortas';

  const app = document.querySelector('#app');

  app.innerHTML = `
    <div class="card form-card">
      <h2>Novo registo de mortalidade</h2>
      <form id="mortality-form" class="form-grid">
        <input type="date" name="log_date" required />
        <input type="number" step="0.01" name="quantity_dead" placeholder="Quantidade morta" required />
        <input type="number" name="age_days" placeholder="Idade em dias" />
        <input type="text" name="probable_cause" placeholder="Causa provável" />
        <textarea name="notes" placeholder="Observações"></textarea>
        <button type="submit" class="btn btn-primary">Guardar registo</button>
      </form>
      <div id="mortality-feedback"></div>
    </div>
  `;
}
