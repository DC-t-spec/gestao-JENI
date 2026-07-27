import { supabase } from './core/supabase-client.js';

const departments = {
  direccao: ['Direcção e Administração', 'Decisões, reuniões e documentos institucionais'],
  financeiro: ['Financeiro', 'Receitas institucionais, quotas e visão financeira consolidada'],
  projectos: ['Projectos e Candidaturas', 'Projectos, financiadores, candidaturas e prazos'],
  marketing: ['Marketing e Comunicação', 'Campanhas, conteúdos, canais e resultados'],
  artistas: ['Agência de Artistas', 'Artistas, oportunidades, contratos e distribuição'],
  avicultura: ['Avicultura', 'Indicadores consolidados do JENI Frangos e ovos'],
  tarefas: ['Tarefas e Agenda', 'Responsabilidades, prioridades e prazos da equipa'],
  'recursos-humanos': ['Recursos Humanos', 'Colaboradores, contratos, desempenho e formação'],
};
const loading = document.querySelector('#management-loading');
const denied = document.querySelector('#management-denied');
const app = document.querySelector('#management-app');
const content = document.querySelector('#management-content');
let profile;

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return window.location.replace('./index.html');
  const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  profile = data;
  loading.hidden = true;
  if (profile?.role !== 'admin') { denied.hidden = false; return; }
  app.hidden = false;
  document.querySelector('#management-user').textContent = profile.full_name || profile.email;
  document.querySelectorAll('[data-department]').forEach(button => button.addEventListener('click', () => renderDepartment(button.dataset.department)));
  document.querySelector('#management-logout').addEventListener('click', async () => { await supabase.auth.signOut(); window.location.replace('./index.html'); });
  await renderDepartment(location.hash.replace('#','') || 'direccao');
}

async function renderDepartment(key) {
  if (!departments[key]) key = 'direccao';
  location.hash = key;
  document.querySelector('#department-title').textContent = departments[key][0];
  document.querySelector('#department-subtitle').textContent = departments[key][1];
  document.querySelectorAll('[data-department]').forEach(b => b.classList.toggle('active', b.dataset.department === key));
  if (key === 'financeiro') return renderFinance();
  if (key === 'avicultura') return renderPoultry();
  if (key === 'tarefas') return renderTasks();
  return renderRecords(key);
}

async function renderRecords(department) {
  const { data: rows, error } = await supabase.from('department_records').select('*').eq('department', department).order('created_at', { ascending:false });
  if (error) return showError(error);
  content.innerHTML = `<div class="grid gap-14">
    <div class="card department-intro"><h3>Novo registo</h3><form id="record-form" class="form-grid">
      <input name="title" placeholder="Título" required><input name="category" placeholder="Categoria">
      <input name="responsible_name" placeholder="Responsável"><select name="status"><option value="planned">Planeado</option><option value="in_progress">Em curso</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select>
      <input type="date" name="start_date"><input type="date" name="due_date"><input type="number" step="0.01" min="0" name="amount" placeholder="Valor, quando aplicável">
      <textarea name="notes" placeholder="Descrição ou observações"></textarea><button class="btn btn-primary">Guardar registo</button>
    </form><div id="record-feedback"></div></div>
    <div class="card"><h3>Registos do departamento</h3><div class="table-wrap"><table><thead><tr><th>Título</th><th>Categoria</th><th>Responsável</th><th>Prazo</th><th>Estado</th></tr></thead><tbody>
    ${(rows||[]).map(r=>`<tr><td>${r.title}</td><td>${r.category||'-'}</td><td>${r.responsible_name||'-'}</td><td>${r.due_date||'-'}</td><td><span class="status-pill">${r.status}</span></td></tr>`).join('')||'<tr><td colspan="5">Sem registos.</td></tr>'}
    </tbody></table></div></div></div>`;
  document.querySelector('#record-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    const { error }=await supabase.from('department_records').insert({department,title:fd.get('title'),category:fd.get('category')||null,responsible_name:fd.get('responsible_name')||null,status:fd.get('status'),start_date:fd.get('start_date')||null,due_date:fd.get('due_date')||null,amount:Number(fd.get('amount')||0),notes:fd.get('notes')||null,created_by:profile.id});
    if(error) return feedback(error.message); await renderRecords(department);
  });
}

async function renderFinance() {
  const [{data:s,error},{data:projects},{data:dues}] = await Promise.all([
    supabase.from('company_financial_summary').select('*').single(),
    supabase.from('company_projects').select('*').order('received_date',{ascending:false}).limit(10),
    supabase.from('partner_dues').select('*').order('payment_date',{ascending:false}).limit(10),
  ]);
  if(error) return showError(error);
  content.innerHTML=`<div class="grid gap-14"><div class="dashboard-grid">
    ${stat('Receita da avicultura',money(s.poultry_revenue))}${stat('Ganhos de projectos',money(s.project_income))}${stat('Quotas dos sócios',money(s.partner_dues))}${stat('Receita geral',money(s.total_income))}
    </div><div class="split"><div class="card"><h3>Registar ganho de projecto</h3><form id="finance-project-form" class="form-grid">
    <input name="project_name" placeholder="Projecto" required><input name="client_name" placeholder="Cliente/financiador"><input type="date" name="received_date" required>
    <input type="number" name="income_amount" min="0" step="0.01" placeholder="Valor recebido" required><button class="btn btn-primary">Guardar ganho</button></form><div id="finance-project-feedback"></div></div>
    <div class="card"><h3>Registar quota</h3><form id="finance-due-form" class="form-grid"><input name="partner_name" placeholder="Nome do sócio" required>
    <input type="month" name="due_month" required><input type="date" name="payment_date" required><input type="number" name="amount" min="0" step="0.01" value="100" required>
    <button class="btn btn-primary">Guardar quota</button></form><div id="finance-due-feedback"></div></div></div>
    <div class="split"><div class="card"><h3>Projectos recentes</h3>${simpleTable(['Data','Projecto','Ganho'],(projects||[]).map(p=>[p.received_date,p.project_name,money(p.income_amount)]))}</div>
    <div class="card"><h3>Quotas recentes</h3>${simpleTable(['Mês','Sócio','Valor'],(dues||[]).map(d=>[d.due_month,d.partner_name,money(d.amount)]))}</div></div>
    </div>`;
  document.querySelector('#finance-project-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('company_projects').insert({project_name:fd.get('project_name'),client_name:fd.get('client_name')||null,received_date:fd.get('received_date'),income_amount:Number(fd.get('income_amount')),created_by:profile.id});if(error)return feedback(error.message,'finance-project-feedback');await renderFinance();});
  document.querySelector('#finance-due-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('partner_dues').insert({partner_name:fd.get('partner_name'),due_month:`${fd.get('due_month')}-01`,payment_date:fd.get('payment_date'),amount:Number(fd.get('amount')),created_by:profile.id});if(error)return feedback(error.message,'finance-due-feedback');await renderFinance();});
}

async function renderPoultry() {
  const [{data:eggs,error},{data:birds}] = await Promise.all([
    supabase.from('egg_business_summary').select('*').single(), supabase.from('dashboard_summary').select('*').single()
  ]);
  if(error) return showError(error);
  content.innerHTML=`<div class="dashboard-grid">${stat('Frangos vivos',birds?.total_birds_alive||0)}${stat('Poedeiras vivas',eggs.layers_alive)}${stat('Stock de ovos',eggs.eggs_in_stock)}${stat('Receita de ovos',money(eggs.egg_revenue))}</div>
  <div class="card mt-16"><h3>Gestão operacional</h3><p>Os registos detalhados de compras, frangos, mortalidade, produção e vendas de ovos permanecem no <a href="./index.html"><strong>JENI Frangos</strong></a>.</p></div>`;
}

async function renderTasks() {
  const [{data:tasks,error},{data:users}] = await Promise.all([
    supabase.from('company_tasks').select('*,profiles!company_tasks_assigned_to_fkey(full_name,email)').order('due_date'),
    supabase.from('profiles').select('id,full_name,email').eq('is_active',true)
  ]);
  if(error) return showError(error);
  content.innerHTML=`<div class="grid gap-14"><div class="card"><h3>Atribuir tarefa</h3><form id="task-form" class="form-grid">
    <input name="title" placeholder="Tarefa" required><select name="assigned_to" required><option value="">Responsável</option>${(users||[]).map(u=>`<option value="${u.id}">${u.full_name||u.email}</option>`).join('')}</select>
    <input type="date" name="due_date"><select name="priority"><option value="normal">Prioridade normal</option><option value="high">Alta</option><option value="low">Baixa</option></select>
    <textarea name="description" placeholder="Descrição"></textarea><button class="btn btn-primary">Atribuir</button></form><div id="task-feedback"></div></div>
    <div class="card"><h3>Tarefas</h3>${simpleTable(['Tarefa','Responsável','Prazo','Prioridade','Estado'],(tasks||[]).map(t=>[t.title,t.profiles?.full_name||t.profiles?.email||'-',t.due_date||'-',t.priority,t.status]))}</div></div>`;
  document.querySelector('#task-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('company_tasks').insert({title:fd.get('title'),assigned_to:fd.get('assigned_to'),due_date:fd.get('due_date')||null,priority:fd.get('priority'),description:fd.get('description')||null,created_by:profile.id});if(error)return feedback(error.message,'task-feedback');await renderTasks();});
}

const money=v=>`${Number(v||0).toFixed(2)} MZN`;
const stat=(label,value)=>`<div class="card stat"><h4>${label}</h4><strong>${value}</strong></div>`;
const simpleTable=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}">Sem registos.</td></tr>`}</tbody></table></div>`;
function feedback(message,id='record-feedback'){const el=document.querySelector(`#${id}`);if(el)el.innerHTML=`<div class="feedback error">${message}</div>`;}
function showError(error){content.innerHTML=`<div class="card"><h3>Não foi possível carregar</h3><div class="feedback error">${error.message}</div></div>`;}

await init();
