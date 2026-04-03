import { supabase } from '../core/supabase-client.js';
import { state } from '../core/state.js';
import { canAccessAdmin, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';
import { fetchBatches } from '../core/data.js';

export async function renderSettings() {
  setPageHeader('Configuração', 'Gestão de lotes, utilizadores e auditoria');

  if (!canAccessAdmin()) {
    dom.pageContent.innerHTML = `<div class="card"><h3>Acesso restrito</h3><p class="muted">Esta área é apenas para administradores.</p></div>`;
    return;
  }

  const [{ data: profiles }, { data: audit }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(25),
  ]);

  dom.pageContent.innerHTML = `
    <div class="grid gap-14">
      <div class="split">
        <div class="card">
          <h3>Novo lote</h3>
          <form id="batch-form" class="form-grid">
            <div class="field"><label>Nome do lote</label><input type="text" name="name" required placeholder="Ex: Lote Abril 2026" /></div>
            <div class="field"><label>Data de início</label><input type="date" name="start_date" required /></div>
            <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
            <div class="field full"><button class="btn btn-primary" type="submit">Criar lote</button></div>
          </form>
          <div id="batch-feedback"></div>
        </div>

        <div class="card">
          <h3>Utilizadores</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Ativo</th></tr></thead>
              <tbody>
                ${(profiles || []).map((user) => `
                  <tr><td>${user.full_name || ''}</td><td>${user.email || ''}</td><td>${user.role || ''}</td><td>${user.is_active ? 'Sim' : 'Não'}</td></tr>
                `).join('') || '<tr><td colspan="4">Sem utilizadores.</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="feedback warning mt-16">Para promover um utilizador a <strong>admin</strong>, faça update na tabela <strong>profiles</strong> no Supabase.</div>
        </div>
      </div>

      <div class="card">
        <h3>Lotes existentes</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Início</th><th>Ativo</th></tr></thead>
            <tbody>
              ${state.batches.map((batch) => `<tr><td>${batch.name}</td><td>${batch.start_date || ''}</td><td>${batch.is_active ? 'Sim' : 'Não'}</td></tr>`).join('') || '<tr><td colspan="3">Sem lotes.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>Auditoria recente</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Quando</th><th>Ação</th><th>Tabela</th><th>Registo</th></tr></thead>
            <tbody>
              ${(audit || []).map((log) => `
                <tr><td>${log.created_at || ''}</td><td>${log.action_type || ''}</td><td>${log.table_name || ''}</td><td>${log.record_id || ''}</td></tr>
              `).join('') || '<tr><td colspan="4">Sem auditoria disponível.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  document.querySelector('#batch-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const payload = {
      name: String(fd.get('name')).trim(),
      start_date: fd.get('start_date'),
      notes: String(fd.get('notes') || '').trim() || null,
      created_by: getCurrentUserId(),
    };
    const { error } = await supabase.from('batches').insert(payload);
    const feedback = document.querySelector('#batch-feedback');
    if (error) return showFeedback(feedback, error.message, 'error');
    showFeedback(feedback, 'Lote criado com sucesso.', 'success');
    await fetchBatches();
    await renderSettings();
  });
}
