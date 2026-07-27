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
  if (key === 'direccao') return renderDirection();
  if (key === 'financeiro') return renderFinance();
  if (key === 'projectos') return renderProjects();
  if (key === 'avicultura') return renderPoultry();
  if (key === 'tarefas') return renderTasks();
  return renderRecords(key);
}

async function renderDirection() {
  const [{data:s,error},{data:partners},{data:dues}] = await Promise.all([
    supabase.from('management_dashboard').select('*').single(),
    supabase.from('partners').select('*').order('full_name'),
    supabase.from('partner_dues').select('*').order('payment_date',{ascending:false}).limit(12),
  ]);
  if(error) return showError(error);
  content.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid">
      ${stat('Receitas institucionais',money(s.institutional_income))}${stat('Despesas institucionais',money(s.institutional_expenses))}
      ${stat('Saldo institucional',money(s.institutional_balance))}${stat('Receita da avicultura',money(Number(s.chicken_revenue)+Number(s.egg_revenue)))}
      ${stat('Ganhos de projectos',money(s.project_income))}${stat('Quotas recebidas',money(s.partner_dues_income))}
      ${stat('Candidaturas activas',s.active_applications)}${stat('Tarefas pendentes',`${s.pending_tasks} (${s.overdue_tasks} atrasadas)`)}
    </div>
    <div class="split">
      <div class="card"><h3>Novo sócio</h3><form id="partner-form" class="form-grid">
        <input name="full_name" placeholder="Nome completo" required><input type="email" name="email" placeholder="Email">
        <input name="phone" placeholder="Telefone"><input type="number" name="monthly_due" min="0" step="0.01" value="100" required>
        <input type="date" name="joined_at"><textarea name="notes" placeholder="Observações"></textarea>
        <button class="btn btn-primary">Guardar sócio</button></form><div id="partner-feedback"></div></div>
      <div class="card"><h3>Registar quota</h3><form id="direction-due-form" class="form-grid">
        <select name="partner_name" required><option value="">Seleccionar sócio</option>${(partners||[]).filter(p=>p.is_active).map(p=>`<option value="${p.full_name}">${p.full_name}</option>`).join('')}</select>
        <input type="month" name="due_month" required><input type="date" name="payment_date" required>
        <input type="number" name="amount" min="0" step="0.01" value="100" required><button class="btn btn-primary">Guardar quota</button>
      </form><div id="direction-due-feedback"></div></div>
    </div>
    <div class="split">
      <div class="card"><h3>Sócios</h3>${actionTable(['Nome','Contacto','Quota mensal','Estado','Acções'],(partners||[]).map(p=>[
        p.full_name,p.email||p.phone||'-',money(p.monthly_due),p.is_active?'Activo':'Inactivo',
        actions('partners',p.id,true)
      ]))}</div>
      <div class="card"><h3>Últimas quotas</h3>${simpleTable(['Mês','Sócio','Valor'],(dues||[]).map(d=>[d.due_month,d.partner_name,money(d.amount)]))}</div>
    </div></div>`;
  document.querySelector('#partner-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('partners').insert({full_name:fd.get('full_name'),email:fd.get('email')||null,phone:fd.get('phone')||null,monthly_due:Number(fd.get('monthly_due')),joined_at:fd.get('joined_at')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'partner-feedback');await renderDirection();});
  document.querySelector('#direction-due-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('partner_dues').insert({partner_name:fd.get('partner_name'),due_month:`${fd.get('due_month')}-01`,payment_date:fd.get('payment_date'),amount:Number(fd.get('amount')),created_by:profile.id});if(error)return feedback(error.message,'direction-due-feedback');await renderDirection();});
  bindActions(renderDirection);
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
    <div class="card"><h3>Registos do departamento</h3><div class="table-wrap"><table><thead><tr><th>Título</th><th>Categoria</th><th>Responsável</th><th>Prazo</th><th>Estado</th><th>Acções</th></tr></thead><tbody>
    ${(rows||[]).map(r=>`<tr><td>${r.title}</td><td>${r.category||'-'}</td><td>${r.responsible_name||'-'}</td><td>${r.due_date||'-'}</td><td><span class="status-pill">${r.status}</span></td><td>${actions('department_records',r.id,true)}</td></tr>`).join('')||'<tr><td colspan="6">Sem registos.</td></tr>'}
    </tbody></table></div></div></div>`;
  document.querySelector('#record-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    const { error }=await supabase.from('department_records').insert({department,title:fd.get('title'),category:fd.get('category')||null,responsible_name:fd.get('responsible_name')||null,status:fd.get('status'),start_date:fd.get('start_date')||null,due_date:fd.get('due_date')||null,amount:Number(fd.get('amount')||0),notes:fd.get('notes')||null,created_by:profile.id});
    if(error) return feedback(error.message); await renderRecords(department);
  });
  bindActions(()=>renderRecords(department));
}

async function renderFinance() {
  const [{data:s,error},{data:projects},{data:transactions}] = await Promise.all([
    supabase.from('management_dashboard').select('*').single(),
    supabase.from('company_projects').select('*').order('received_date',{ascending:false}).limit(10),
    supabase.from('institutional_transactions').select('*').order('transaction_date',{ascending:false}).limit(30),
  ]);
  if(error) return showError(error);
  content.innerHTML=`<div class="grid gap-14"><div class="dashboard-grid">
    ${stat('Receitas institucionais',money(s.institutional_income))}${stat('Despesas institucionais',money(s.institutional_expenses))}
    ${stat('Saldo institucional',money(s.institutional_balance))}${stat('Receita geral identificada',money(Number(s.institutional_income)+Number(s.chicken_revenue)+Number(s.egg_revenue)+Number(s.project_income)+Number(s.partner_dues_income)))}
    </div>
    <div class="card"><h3>Novo movimento financeiro</h3><form id="transaction-form" class="form-grid">
      <input type="date" name="transaction_date" required><select name="direction"><option value="income">Receita</option><option value="expense">Despesa</option></select>
      <input name="category" placeholder="Categoria: salário, transporte, honorário…" required>
      <select name="department"><option value="direccao">Direcção</option><option value="financeiro">Financeiro</option><option value="projectos">Projectos</option><option value="marketing">Marketing</option><option value="artistas">Agência de Artistas</option><option value="recursos-humanos">Recursos Humanos</option></select>
      <input name="description" placeholder="Descrição" required><input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor" required>
      <select name="payment_method"><option value="">Método de pagamento</option><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="bank_transfer">Transferência</option></select>
      <select name="project_id"><option value="">Sem projecto associado</option>${(projects||[]).map(p=>`<option value="${p.id}">${p.project_name}</option>`).join('')}</select>
      <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar movimento</button>
    </form><div id="transaction-feedback"></div></div>
    <div class="card"><h3>Movimentos recentes</h3>${actionTable(['Data','Tipo','Categoria','Descrição','Valor','Acções'],(transactions||[]).map(t=>[
      t.transaction_date,t.direction==='income'?'Receita':'Despesa',t.category,t.description,money(t.amount),actions('institutional_transactions',t.id)
    ]))}</div></div>`;
  document.querySelector('#transaction-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('institutional_transactions').insert({transaction_date:fd.get('transaction_date'),direction:fd.get('direction'),category:fd.get('category'),department:fd.get('department'),description:fd.get('description'),amount:Number(fd.get('amount')),payment_method:fd.get('payment_method')||null,project_id:fd.get('project_id')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'transaction-feedback');await renderFinance();});
  bindActions(renderFinance);
}

async function renderPoultry() {
  const [{data:eggs,error},{data:birds}] = await Promise.all([
    supabase.from('egg_business_summary').select('*').single(), supabase.from('dashboard_summary').select('*').single()
  ]);
  if(error) return showError(error);
  content.innerHTML=`<div class="dashboard-grid">${stat('Frangos vivos',birds?.total_birds_alive||0)}${stat('Poedeiras vivas',eggs.layers_alive)}${stat('Stock de ovos',eggs.eggs_in_stock)}${stat('Receita de ovos',money(eggs.egg_revenue))}</div>
  <div class="card mt-16"><h3>Gestão operacional</h3><p>Os registos detalhados de compras, frangos, mortalidade, produção e vendas de ovos permanecem no <a href="./index.html"><strong>JENI Frangos</strong></a>.</p></div>`;
}

async function renderProjects() {
  const {data:rows,error}=await supabase.from('funding_opportunities').select('*').order('deadline',{ascending:true});
  if(error)return showError(error);
  content.innerHTML=`<div class="grid gap-14"><div class="card"><h3>Novo projecto ou candidatura</h3><form id="funding-form" class="form-grid">
    <input name="title" placeholder="Nome do projecto ou edital" required><input name="funder" placeholder="Financiador">
    <input name="country" placeholder="País"><input type="number" name="requested_amount" min="0" step="0.01" placeholder="Valor solicitado">
    <input type="date" name="deadline"><input name="responsible_name" placeholder="Responsável"><input name="partners_text" placeholder="Parceiros">
    <select name="status"><option value="identified">Identificado</option><option value="preparing">Em preparação</option><option value="submitted">Submetido</option><option value="approved">Aprovado</option><option value="rejected">Recusado</option></select>
    <textarea name="notes" placeholder="Observações e documentos necessários"></textarea><button class="btn btn-primary">Guardar candidatura</button>
  </form><div id="funding-feedback"></div></div>
  <div class="card"><h3>Projectos e candidaturas</h3>${actionTable(['Título','Financiador','Prazo','Valor','Responsável','Estado','Acções'],(rows||[]).map(r=>[
    r.title,r.funder||'-',r.deadline||'-',money(r.requested_amount),r.responsible_name||'-',r.status,actions('funding_opportunities',r.id,true)
  ]))}</div></div>`;
  document.querySelector('#funding-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('funding_opportunities').insert({title:fd.get('title'),funder:fd.get('funder')||null,country:fd.get('country')||null,requested_amount:Number(fd.get('requested_amount')||0),deadline:fd.get('deadline')||null,responsible_name:fd.get('responsible_name')||null,partners_text:fd.get('partners_text')||null,status:fd.get('status'),notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'funding-feedback');await renderProjects();});
  bindActions(renderProjects);
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
    <div class="card"><h3>Tarefas</h3>${actionTable(['Tarefa','Responsável','Prazo','Prioridade','Estado','Acções'],(tasks||[]).map(t=>[
      t.title,t.profiles?.full_name||t.profiles?.email||'-',t.due_date||'-',t.priority,
      `<select data-status-table="company_tasks" data-id="${t.id}"><option value="pending" ${t.status==='pending'?'selected':''}>Pendente</option><option value="in_progress" ${t.status==='in_progress'?'selected':''}>Em curso</option><option value="completed" ${t.status==='completed'?'selected':''}>Concluída</option><option value="cancelled" ${t.status==='cancelled'?'selected':''}>Cancelada</option></select>`,
      actions('company_tasks',t.id)
    ]))}</div></div>`;
  document.querySelector('#task-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('company_tasks').insert({title:fd.get('title'),assigned_to:fd.get('assigned_to'),due_date:fd.get('due_date')||null,priority:fd.get('priority'),description:fd.get('description')||null,created_by:profile.id});if(error)return feedback(error.message,'task-feedback');await renderTasks();});
  document.querySelectorAll('[data-status-table]').forEach(select=>select.addEventListener('change',async()=>{const payload={status:select.value,completed_at:select.value==='completed'?new Date().toISOString():null};const{error}=await supabase.from(select.dataset.statusTable).update(payload).eq('id',select.dataset.id);if(error)window.alert(error.message);await renderTasks();}));
  bindActions(renderTasks);
}

const money=v=>`${Number(v||0).toFixed(2)} MZN`;
const stat=(label,value)=>`<div class="card stat"><h4>${label}</h4><strong>${value}</strong></div>`;
const simpleTable=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}">Sem registos.</td></tr>`}</tbody></table></div>`;
const actionTable=simpleTable;
const actions=(table,id,canToggle=false)=>`<div style="display:flex;gap:6px;white-space:nowrap"><button class="btn btn-secondary" data-edit-table="${table}" data-id="${id}">Editar</button>${canToggle?`<button class="btn btn-secondary" data-toggle-table="${table}" data-id="${id}">Alterar estado</button>`:''}<button class="btn btn-secondary" data-delete-table="${table}" data-id="${id}">Eliminar</button></div>`;
function bindActions(rerender){
  document.querySelectorAll('[data-edit-table]').forEach(button=>button.addEventListener('click',async()=>{
    const table=button.dataset.editTable;
    const field={partners:'full_name',institutional_transactions:'description',funding_opportunities:'title',department_records:'title',company_tasks:'title'}[table];
    const{data,error:readError}=await supabase.from(table).select(field).eq('id',button.dataset.id).single();
    if(readError)return window.alert(readError.message);
    const value=window.prompt('Introduza o novo conteúdo:',data[field]);
    if(value===null||!value.trim())return;
    const updatePayload={[field]:value.trim()};
    if(!['partners','company_tasks'].includes(table))updatePayload.updated_at=new Date().toISOString();
    const{error}=await supabase.from(table).update(updatePayload).eq('id',button.dataset.id);
    if(error)return window.alert(error.message);await rerender();
  }));
  document.querySelectorAll('[data-delete-table]').forEach(button=>button.addEventListener('click',async()=>{
    if(!window.confirm('Tem certeza de que pretende eliminar este registo?'))return;
    const{error}=await supabase.from(button.dataset.deleteTable).delete().eq('id',button.dataset.id);
    if(error)return window.alert(error.message);await rerender();
  }));
  document.querySelectorAll('[data-toggle-table]').forEach(button=>button.addEventListener('click',async()=>{
    const table=button.dataset.toggleTable;
    const field=table==='partners'?'is_active':'status';
    let value;
    if(table==='partners'){
      const{data}=await supabase.from(table).select('is_active').eq('id',button.dataset.id).single();value=!data.is_active;
    }else{
      const{data}=await supabase.from(table).select('status').eq('id',button.dataset.id).single();
      const cycle={planned:'in_progress',identified:'preparing',preparing:'submitted',submitted:'approved',in_progress:'completed',completed:'planned',approved:'identified',rejected:'identified',cancelled:'planned'};
      value=cycle[data.status]||'in_progress';
    }
    const updatePayload={[field]:value};
    if(table!=='partners')updatePayload.updated_at=new Date().toISOString();
    const{error}=await supabase.from(table).update(updatePayload).eq('id',button.dataset.id);
    if(error)return window.alert(error.message);await rerender();
  }));
}
function feedback(message,id='record-feedback'){const el=document.querySelector(`#${id}`);if(el)el.innerHTML=`<div class="feedback error">${message}</div>`;}
function showError(error){content.innerHTML=`<div class="card"><h3>Não foi possível carregar</h3><div class="feedback error">${error.message}</div></div>`;}

await init();
