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

  const [
    { data: profiles, error: profilesError },
    { data: audit, error: auditError },
    batches,
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(25),
    fetchBatches(),
  ]);

  console.log('profilesError:', profilesError);
  console.log('auditError:', auditError);
  console.log('audit:', audit);
  console.log('batches:', batches);

  dom.pageContent.innerHTML = `
    ...
  `;
