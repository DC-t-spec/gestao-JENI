import { supabase } from '../core/supabase-client.js';
import { canAccessAdmin, formatMoney, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

export async function renderGeneralManagement() {
  setPageHeader('Gestão Geral da JENI', 'Avicultura, projectos, quotas e tarefas');
  if (!canAccessAdmin()) {
    dom.pageContent.innerHTML = '<div class="card"><h3>Acesso restrito</h3><p>Área exclusiva para administradores.</p></div>';
    return;
  }
  const [{ data: s, error }, { data: projects }, { data: dues }, { data: tasks }, { data: profiles }] = await Promise.all([
    supabase.from('company_financial_summary').select('*').single(),
    supabase.from('company_projects').select('*').order('received_date', { ascending: false }),
    supabase.from('partner_dues').select('*').order('payment_date', { ascending: false }),
    supabase.from('company_tasks').select('*, profiles!company_tasks_assigned_to_fkey(full_name,email)').order('due_date'),
    supabase.from('profiles').select('id,full_name,email').eq('is_active', true).order('full_name'),
  ]);
  if (error) {
    dom.pageContent.innerHTML = `<div class="card"><h3>Configuração necessária</h3><p>Execute a actualização SQL no Supabase.</p><div class="feedback error">${error.message}</div></div>`;
    return;
  }
  const userOptions = (profiles || []).map(p => `<option value="${p.id}">${p.full_name || p.email}</option>`).join('');
  dom.pageContent.innerHTML = `<div class="grid gap-14">
    <div class="dashboard-grid">
      <div class="card stat"><h4>Receita da avicultura</h4><strong>${formatMoney(s.poultry_revenue)}</strong></div>
      <div class="card stat"><h4>Ganhos de projectos</h4><strong>${formatMoney(s.project_income)}</strong></div>
      <div class="card stat"><h4>Quotas dos sócios</h4><strong>${formatMoney(s.partner_dues)}</strong></div>
      <div class="card stat"><h4>Receita geral</h4><strong>${formatMoney(s.total_income)}</strong></div>
    </div>
    <div class="split">
      <div class="card"><h3>Ganho de projecto</h3><form id="project-form" class="form-grid">
        <input name="project_name" placeholder="Nome do projecto" required><input name="client_name" placeholder="Cliente/financiador">
        <input type="date" name="received_date" required><input type="number" min="0" step="0.01" name="income_amount" placeholder="Valor recebido" required>
        <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar ganho</button>
      </form><div id="project-feedback"></div></div>
      <div class="card"><h3>Quota de sócio</h3><form id="due-form" class="form-grid">
        <input name="partner_name" placeholder="Nome do sócio" required><input type="month" name="due_month" required>
        <input type="date" name="payment_date" required><input type="number" min="0" step="0.01" name="amount" value="100" required>
        <button class="btn btn-primary">Guardar quota</button></form><div id="due-feedback"></div></div>
    </div>
    <div class="card"><h3>Atribuir tarefa</h3><form id="task-form" class="form-grid">
      <input name="title" placeholder="Tarefa" required><select name="assigned_to" required><option value="">Responsável</option>${userOptions}</select>
      <input type="date" name="due_date"><select name="priority"><option value="normal">Prioridade normal</option><option value="high">Alta</option><option value="low">Baixa</option></select>
      <textarea name="description" placeholder="Descrição"></textarea><button class="btn btn-primary">Atribuir tarefa</button>
    </form><div id="task-feedback"></div></div>
    <div class="split">
      <div class="card"><h3>Projectos</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Projecto</th><th>Cliente</th><th>Ganho</th></tr></thead><tbody>
      ${(projects || []).map(p => `<tr><td>${p.received_date}</td><td>${p.project_name}</td><td>${p.client_name || '-'}</td><td>${formatMoney(p.income_amount)}</td></tr>`).join('') || '<tr><td colspan="4">Sem projectos.</td></tr>'}</tbody></table></div></div>
      <div class="card"><h3>Quotas</h3><div class="table-wrap"><table><thead><tr><th>Mês</th><th>Sócio</th><th>Data</th><th>Valor</th></tr></thead><tbody>
      ${(dues || []).map(d => `<tr><td>${d.due_month}</td><td>${d.partner_name}</td><td>${d.payment_date}</td><td>${formatMoney(d.amount)}</td></tr>`).join('') || '<tr><td colspan="4">Sem quotas.</td></tr>'}</tbody></table></div></div>
    </div>
    <div class="card"><h3>Tarefas dos utilizadores</h3><div class="table-wrap"><table><thead><tr><th>Tarefa</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Estado</th></tr></thead><tbody>
    ${(tasks || []).map(t => `<tr><td>${t.title}</td><td>${t.profiles?.full_name || t.profiles?.email || '-'}</td><td>${t.due_date || '-'}</td><td>${t.priority}</td><td>${t.status}</td></tr>`).join('') || '<tr><td colspan="5">Sem tarefas.</td></tr>'}</tbody></table></div></div>
  </div>`;
  bind('#project-form', '#project-feedback', 'company_projects', fd => ({
    project_name: fd.get('project_name'), client_name: fd.get('client_name') || null, received_date: fd.get('received_date'),
    income_amount: Number(fd.get('income_amount')), notes: fd.get('notes') || null, created_by: getCurrentUserId(),
  }));
  bind('#due-form', '#due-feedback', 'partner_dues', fd => ({
    partner_name: fd.get('partner_name'), due_month: `${fd.get('due_month')}-01`, payment_date: fd.get('payment_date'),
    amount: Number(fd.get('amount')), created_by: getCurrentUserId(),
  }));
  bind('#task-form', '#task-feedback', 'company_tasks', fd => ({
    title: fd.get('title'), assigned_to: fd.get('assigned_to'), due_date: fd.get('due_date') || null,
    priority: fd.get('priority'), description: fd.get('description') || null, created_by: getCurrentUserId(),
  }));
}

function bind(form, feedbackId, table, makePayload) {
  document.querySelector(form).addEventListener('submit', async e => {
    e.preventDefault(); const feedback = document.querySelector(feedbackId);
    const { error } = await supabase.from(table).insert(makePayload(new FormData(e.currentTarget)));
    if (error) return showFeedback(feedback, error.message, 'error');
    await renderGeneralManagement();
  });
}
