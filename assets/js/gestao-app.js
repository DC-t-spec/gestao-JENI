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

function validIdentity(value) {
  const text = String(value ?? '').trim();
  return text && !['null', 'undefined'].includes(text.toLowerCase()) ? text : '';
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return window.location.replace('./index.html');
  const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  profile = data;
  loading.hidden = true;
  if (profile?.role !== 'admin') { denied.hidden = false; return; }
  app.hidden = false;
  document.querySelector('#management-user').textContent =
    validIdentity(profile.full_name) ||
    validIdentity(profile.email) ||
    validIdentity(session.user.email) ||
    'Administradora';
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
  if (key === 'marketing') return renderMarketing();
  if (key === 'artistas') return renderArtists();
  if (key === 'avicultura') return renderPoultry();
  if (key === 'tarefas') return renderTasks();
  if (key === 'recursos-humanos') return renderHumanResources();
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
  const [{data:s,error},{data:accounts},{data:projects},{data:transactions},{data:obligations},{data:budgets},{data:transfers},{data:advances}] = await Promise.all([
    supabase.from('finance_summary').select('*').single(),
    supabase.from('finance_account_balances').select('*').order('account_name'),
    supabase.from('company_projects').select('id,project_name').order('project_name'),
    supabase.from('institutional_transactions').select('*').order('transaction_date',{ascending:false}).limit(50),
    supabase.from('finance_obligations').select('*').order('due_date').limit(50),
    supabase.from('finance_budget_execution').select('*').order('period_start',{ascending:false}).limit(30),
    supabase.from('finance_transfers_display').select('*').order('transfer_date',{ascending:false}).limit(30),
    supabase.from('finance_advances').select('*').order('request_date',{ascending:false}).limit(30)
  ]);
  if(error)return showError(error);
  const accountOpts=(accounts||[]).filter(a=>a.is_active).map(a=>`<option value="${a.id}">${a.account_name} — ${money(a.current_balance)}</option>`).join('');
  const projectOpts=(projects||[]).map(p=>`<option value="${p.id}">${p.project_name}</option>`).join('');
  const obligationOpts=(obligations||[]).filter(o=>!['paid','cancelled'].includes(o.status)).map(o=>`<option value="${o.id}">${o.description} — falta ${money(Number(o.total_amount)-Number(o.paid_amount))}</option>`).join('');
  const depts='<option value="direccao">Direcção</option><option value="financeiro">Financeiro</option><option value="projectos">Projectos</option><option value="marketing">Marketing</option><option value="artistas">Agência de Artistas</option><option value="avicultura">Avicultura</option><option value="tarefas">Tarefas e Agenda</option><option value="recursos-humanos">Recursos Humanos</option>';
  content.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid">${stat('Saldo geral',money(s.total_balance))}${stat('Receitas do mês',money(s.month_income))}
      ${stat('Despesas do mês',money(s.month_expenses))}${stat('Resultado do mês',money(s.month_result))}
      ${stat('A receber',money(s.total_receivable))}${stat('A pagar',money(s.total_payable))}
      ${stat('Orçamento disponível',money(s.available_budget))}${stat('Adiantamentos pendentes',money(s.pending_advances))}</div>
    <div class="card"><h3>Caixa e contas bancárias</h3><form id="finance-account-form" class="form-grid">
      <input name="account_name" placeholder="Nome da conta ou caixa" required><select name="account_type"><option value="cash">Caixa</option><option value="bank">Conta bancária</option><option value="mobile_money">Carteira móvel</option><option value="other">Outra</option></select>
      <input name="institution_name" placeholder="Banco/instituição"><input name="account_reference" placeholder="Número ou referência">
      <input type="number" name="opening_balance" step="0.01" placeholder="Saldo inicial"><input name="currency" value="MZN" placeholder="Moeda">
      <button class="btn btn-primary">Criar conta</button></form><div id="finance-account-feedback"></div>
      ${actionTable(['Conta','Tipo','Instituição','Saldo','Estado','Acções'],(accounts||[]).map(a=>[a.account_name,a.account_type,a.institution_name||'-',money(a.current_balance),a.is_active?'Activa':'Inactiva',actions('finance_accounts',a.id,true)]))}</div>
    <div class="card"><h3>Novo movimento financeiro</h3><form id="finance-transaction-form" class="form-grid">
      <input type="date" name="transaction_date" required><select name="direction"><option value="income">Receita</option><option value="expense">Despesa</option></select>
      <input name="category" placeholder="Categoria: salário, transporte, honorário…" required><select name="department">${depts}</select>
      <input name="description" placeholder="Descrição" required><input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor" required>
      <select name="account_id" required><option value="">Conta/caixa</option>${accountOpts}</select><select name="payment_method"><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="bank_transfer">Transferência</option><option value="card">Cartão</option></select>
      <select name="project_id"><option value="">Sem projecto</option>${projectOpts}</select><select name="approval_status"><option value="approved">Aprovado</option><option value="pending">Aguarda aprovação</option><option value="rejected">Rejeitado</option></select>
      <select name="recurrence"><option value="none">Não recorrente</option><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="yearly">Anual</option></select>
      <input type="url" name="document_url" placeholder="Factura, recibo ou comprovativo"><textarea name="notes" placeholder="Observações"></textarea>
      <button class="btn btn-primary">Guardar movimento</button></form><div id="finance-transaction-feedback"></div></div>
    <div class="split">
      <div class="card"><h3>Conta a pagar ou receber</h3><form id="finance-obligation-form" class="form-grid">
        <select name="obligation_type"><option value="payable">Conta a pagar</option><option value="receivable">Conta a receber</option></select><input name="entity_name" placeholder="Fornecedor, cliente ou colaborador" required>
        <input name="description" placeholder="Descrição" required><input type="number" name="total_amount" min="0.01" step="0.01" placeholder="Valor total" required>
        <input type="date" name="issue_date" required><input type="date" name="due_date" required><select name="department">${depts}</select>
        <select name="project_id"><option value="">Sem projecto</option>${projectOpts}</select><input type="url" name="document_url" placeholder="Factura/documento">
        <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar conta</button></form><div id="finance-obligation-feedback"></div></div>
      <div class="card"><h3>Pagamento ou recebimento parcial</h3><form id="finance-payment-form" class="form-grid">
        <select name="obligation_id" required><option value="">Conta pendente</option>${obligationOpts}</select><input type="date" name="payment_date" required>
        <input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor pago/recebido" required><select name="account_id" required><option value="">Conta/caixa</option>${accountOpts}</select>
        <select name="payment_method"><option value="cash">Dinheiro</option><option value="bank_transfer">Transferência</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="card">Cartão</option></select>
        <input type="url" name="document_url" placeholder="Recibo/comprovativo"><textarea name="notes" placeholder="Observações"></textarea>
        <button class="btn btn-primary">Registar pagamento</button></form><div id="finance-payment-feedback"></div></div>
    </div>
    <div class="split">
      <div class="card"><h3>Orçamento</h3><form id="finance-budget-form" class="form-grid">
        <input name="title" placeholder="Nome do orçamento" required><select name="department">${depts}</select><select name="project_id"><option value="">Sem projecto</option>${projectOpts}</select>
        <input type="date" name="period_start" required><input type="date" name="period_end" required><input type="number" name="budget_amount" min="0" step="0.01" placeholder="Valor orçamentado" required>
        <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar orçamento</button></form><div id="finance-budget-feedback"></div></div>
      <div class="card"><h3>Transferência entre contas</h3><form id="finance-transfer-form" class="form-grid">
        <input type="date" name="transfer_date" required><select name="from_account_id" required><option value="">Conta de origem</option>${accountOpts}</select>
        <select name="to_account_id" required><option value="">Conta de destino</option>${accountOpts}</select><input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor" required>
        <input type="number" name="fee_amount" min="0" step="0.01" placeholder="Taxa"><input type="url" name="document_url" placeholder="Comprovativo">
        <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Transferir</button></form><div id="finance-transfer-feedback"></div></div>
    </div>
    <div class="card"><h3>Adiantamento ou reembolso</h3><form id="finance-advance-form" class="form-grid">
      <select name="advance_type"><option value="advance">Adiantamento</option><option value="reimbursement">Reembolso</option></select><input name="beneficiary_name" placeholder="Beneficiário" required>
      <input type="date" name="request_date" required><input type="date" name="settlement_due_date"><input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor" required>
      <select name="department">${depts}</select><select name="project_id"><option value="">Sem projecto</option>${projectOpts}</select>
      <select name="status"><option value="requested">Solicitado</option><option value="approved">Aprovado</option><option value="paid">Pago</option><option value="settled">Justificado/regularizado</option><option value="rejected">Rejeitado</option></select>
      <input type="url" name="document_url" placeholder="Documento/comprovativo"><textarea name="purpose" placeholder="Finalidade" required></textarea>
      <button class="btn btn-primary">Guardar</button></form><div id="finance-advance-feedback"></div></div>
    <div class="card"><h3>Contas a pagar e receber</h3>${actionTable(['Vencimento','Tipo','Entidade','Descrição','Total','Pago','Saldo','Estado','Acções'],(obligations||[]).map(o=>[o.due_date,o.obligation_type==='payable'?'A pagar':'A receber',o.entity_name,o.description,money(o.total_amount),money(o.paid_amount),money(Number(o.total_amount)-Number(o.paid_amount)),o.status,actions('finance_obligations',o.id)]))}</div>
    <div class="card"><h3>Movimentos recentes</h3>${actionTable(['Data','Tipo','Categoria','Descrição','Departamento','Valor','Aprovação','Acções'],(transactions||[]).map(t=>[t.transaction_date,t.direction==='income'?'Receita':'Despesa',t.category,t.description,t.department||'-',money(t.amount),t.approval_status||'approved',actions('institutional_transactions',t.id)]))}</div>
    <div class="card"><h3>Execução orçamental</h3>${simpleTable(['Orçamento','Departamento','Período','Orçamentado','Executado','Disponível'],(budgets||[]).map(b=>[b.title,b.department||'-',b.period_start+' a '+b.period_end,money(b.budget_amount),money(b.spent_amount),money(Number(b.budget_amount)-Number(b.spent_amount))]))}</div>
    <div class="card"><h3>Transferências e adiantamentos</h3>${actionTable(['Data','Registo','Responsável/Origem','Valor','Estado/Destino','Acções'],[...(transfers||[]).map(t=>[t.transfer_date,'Transferência',t.from_account_name||'-',money(t.amount),t.to_account_name||'-',actions('finance_transfers',t.id)]),...(advances||[]).map(a=>[a.request_date,a.advance_type==='advance'?'Adiantamento':'Reembolso',a.beneficiary_name,money(a.amount),a.status,actions('finance_advances',a.id)])])}</div>
  </div>`;
  const insertForm=(selector,table,make,id)=>document.querySelector(selector).addEventListener('submit',async e=>{e.preventDefault();const{error}=await supabase.from(table).insert(make(new FormData(e.currentTarget)));if(error)return feedback(error.message,id);await renderFinance();});
  insertForm('#finance-account-form','finance_accounts',fd=>({account_name:fd.get('account_name'),account_type:fd.get('account_type'),institution_name:fd.get('institution_name')||null,account_reference:fd.get('account_reference')||null,opening_balance:Number(fd.get('opening_balance')||0),currency:fd.get('currency')||'MZN',created_by:profile.id}),'finance-account-feedback');
  insertForm('#finance-transaction-form','institutional_transactions',fd=>({transaction_date:fd.get('transaction_date'),direction:fd.get('direction'),category:fd.get('category'),department:fd.get('department'),description:fd.get('description'),amount:Number(fd.get('amount')),account_id:fd.get('account_id'),payment_method:fd.get('payment_method'),project_id:fd.get('project_id')||null,approval_status:fd.get('approval_status'),approved_by:fd.get('approval_status')==='approved'?profile.id:null,approved_at:fd.get('approval_status')==='approved'?new Date().toISOString():null,recurrence:fd.get('recurrence'),document_url:fd.get('document_url')||null,notes:fd.get('notes')||null,created_by:profile.id}),'finance-transaction-feedback');
  insertForm('#finance-obligation-form','finance_obligations',fd=>({obligation_type:fd.get('obligation_type'),entity_name:fd.get('entity_name'),description:fd.get('description'),total_amount:Number(fd.get('total_amount')),issue_date:fd.get('issue_date'),due_date:fd.get('due_date'),department:fd.get('department'),project_id:fd.get('project_id')||null,document_url:fd.get('document_url')||null,notes:fd.get('notes')||null,created_by:profile.id}),'finance-obligation-feedback');
  insertForm('#finance-budget-form','finance_budgets',fd=>({title:fd.get('title'),department:fd.get('department'),project_id:fd.get('project_id')||null,period_start:fd.get('period_start'),period_end:fd.get('period_end'),budget_amount:Number(fd.get('budget_amount')),notes:fd.get('notes')||null,created_by:profile.id}),'finance-budget-feedback');
  insertForm('#finance-transfer-form','finance_transfers',fd=>({transfer_date:fd.get('transfer_date'),from_account_id:fd.get('from_account_id'),to_account_id:fd.get('to_account_id'),amount:Number(fd.get('amount')),fee_amount:Number(fd.get('fee_amount')||0),document_url:fd.get('document_url')||null,notes:fd.get('notes')||null,created_by:profile.id}),'finance-transfer-feedback');
  insertForm('#finance-advance-form','finance_advances',fd=>({advance_type:fd.get('advance_type'),beneficiary_name:fd.get('beneficiary_name'),request_date:fd.get('request_date'),settlement_due_date:fd.get('settlement_due_date')||null,amount:Number(fd.get('amount')),department:fd.get('department'),project_id:fd.get('project_id')||null,status:fd.get('status'),document_url:fd.get('document_url')||null,purpose:fd.get('purpose'),created_by:profile.id}),'finance-advance-feedback');
  document.querySelector('#finance-payment-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),id=fd.get('obligation_id');const o=(obligations||[]).find(x=>x.id===id),amount=Number(fd.get('amount'));if(!o)return feedback('Conta não encontrada.','finance-payment-feedback');if(amount>Number(o.total_amount)-Number(o.paid_amount))return feedback('O valor excede o saldo da conta.','finance-payment-feedback');const payment={obligation_id:id,payment_date:fd.get('payment_date'),amount,account_id:fd.get('account_id'),payment_method:fd.get('payment_method'),document_url:fd.get('document_url')||null,notes:fd.get('notes')||null,created_by:profile.id};const{error}=await supabase.from('finance_payments').insert(payment);if(error)return feedback(error.message,'finance-payment-feedback');const total=Number(o.paid_amount)+amount;await supabase.from('finance_obligations').update({paid_amount:total,status:total>=Number(o.total_amount)?'paid':'partial',updated_at:new Date().toISOString()}).eq('id',id);await supabase.from('institutional_transactions').insert({transaction_date:fd.get('payment_date'),direction:o.obligation_type==='payable'?'expense':'income',category:o.obligation_type==='payable'?'Pagamento de conta':'Recebimento',department:o.department,description:o.description,amount,account_id:fd.get('account_id'),payment_method:fd.get('payment_method'),project_id:o.project_id||null,approval_status:'approved',approved_by:profile.id,approved_at:new Date().toISOString(),document_url:fd.get('document_url')||null,created_by:profile.id});await renderFinance();});
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

async function renderArtists() {
  const [{data:summary,error},{data:artists},{data:contracts},{data:activities}] = await Promise.all([
    supabase.from('artist_agency_summary').select('*').single(),
    supabase.from('artists').select('*').order('artistic_name'),
    supabase.from('artist_contracts').select('*,artists(artistic_name)').order('start_date',{ascending:false}),
    supabase.from('artist_activities').select('*,artists(artistic_name)').order('activity_date',{ascending:false}),
  ]);
  if(error)return showError(error);
  const artistOptions=(artists||[]).filter(a=>a.status==='active').map(a=>`<option value="${a.id}">${a.artistic_name}</option>`).join('');
  content.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid">${stat('Artistas activos',summary.active_artists)}${stat('Contratos activos',summary.active_contracts)}
      ${stat('Actividades futuras',summary.upcoming_activities)}${stat('Receita bruta',money(summary.gross_income))}
      ${stat('Ganho da JENI',money(summary.jeni_income))}${stat('Valor dos artistas',money(summary.artist_income))}
      ${stat('Pagamentos pendentes',money(summary.pending_payments))}</div>
    <div class="card"><h3>Cadastrar artista</h3><form id="artist-form" class="form-grid">
      <input name="artistic_name" placeholder="Nome artístico" required><input name="legal_name" placeholder="Nome completo">
      <input type="email" name="email" placeholder="Email"><input name="phone" placeholder="Telefone">
      <input name="genres" placeholder="Género(s) musical(is)"><input name="distributor" placeholder="Distribuidora digital">
      <input type="url" name="spotify_url" placeholder="Link do Spotify"><input type="url" name="youtube_url" placeholder="Link do YouTube">
      <input type="url" name="instagram_url" placeholder="Link do Instagram"><select name="status"><option value="active">Activo</option><option value="prospect">Em negociação</option><option value="inactive">Inactivo</option></select>
      <textarea name="biography" placeholder="Biografia"></textarea><textarea name="notes" placeholder="Observações"></textarea>
      <button class="btn btn-primary">Guardar artista</button></form><div id="artist-feedback"></div></div>
    <div class="split">
      <div class="card"><h3>Novo contrato</h3><form id="artist-contract-form" class="form-grid">
        <select name="artist_id" required><option value="">Seleccionar artista</option>${artistOptions}</select>
        <select name="contract_type"><option value="management">Agenciamento</option><option value="booking">Booking</option><option value="distribution">Distribuição</option><option value="other">Outro</option></select>
        <input type="date" name="start_date" required><input type="date" name="end_date">
        <input name="commission_notes" placeholder="Condições do ganho da JENI"><input type="url" name="document_url" placeholder="Link do contrato">
        <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar contrato</button>
      </form><div id="contract-feedback"></div></div>
      <div class="card"><h3>Nova actividade</h3><form id="artist-activity-form" class="form-grid">
        <select name="artist_id" required><option value="">Seleccionar artista</option>${artistOptions}</select>
        <select name="activity_type"><option value="concert">Concerto</option><option value="release">Lançamento</option><option value="distribution">Distribuição</option><option value="opportunity">Oportunidade</option><option value="application">Candidatura</option><option value="other">Outra</option></select>
        <input name="title" placeholder="Título da actividade" required><input type="date" name="activity_date">
        <input name="organisation" placeholder="Organização/cliente"><input name="location" placeholder="Local">
        <input type="number" name="gross_amount" min="0" step="0.01" placeholder="Valor bruto/cachet">
        <input type="number" name="jeni_income" min="0" step="0.01" placeholder="Ganho manual da JENI">
        <input type="number" name="artist_amount" min="0" step="0.01" placeholder="Valor do artista">
        <select name="payment_status"><option value="pending">Pagamento pendente</option><option value="partial">Parcial</option><option value="paid">Pago</option><option value="cancelled">Cancelado</option></select>
        <select name="status"><option value="planned">Planeada</option><option value="confirmed">Confirmada</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select>
        <input name="platform_links" placeholder="Links de plataformas ou conteúdos"><textarea name="notes" placeholder="Observações"></textarea>
        <button class="btn btn-primary">Guardar actividade</button></form><div id="activity-feedback"></div></div>
    </div>
    <div class="card"><h3>Artistas</h3>${actionTable(['Artista','Nome completo','Contacto','Distribuidora','Estado','Acções'],(artists||[]).map(a=>[
      a.artistic_name,a.legal_name||'-',a.email||a.phone||'-',a.distributor||'-',a.status,actions('artists',a.id)
    ]))}</div>
    <div class="card"><h3>Contratos</h3>${actionTable(['Artista','Tipo','Início','Fim','Estado','Acções'],(contracts||[]).map(c=>[
      c.artists?.artistic_name||'-',c.contract_type,c.start_date,c.end_date||'-',c.status,actions('artist_contracts',c.id)
    ]))}</div>
    <div class="card"><h3>Actividades, cachets e pagamentos</h3>${actionTable(['Data','Artista','Actividade','Tipo','Bruto','JENI','Artista','Pagamento','Acções'],(activities||[]).map(a=>[
      a.activity_date||'-',a.artists?.artistic_name||'-',a.title,a.activity_type,money(a.gross_amount),money(a.jeni_income),money(a.artist_amount),
      `<select data-artist-payment="${a.id}"><option value="pending" ${a.payment_status==='pending'?'selected':''}>Pendente</option><option value="partial" ${a.payment_status==='partial'?'selected':''}>Parcial</option><option value="paid" ${a.payment_status==='paid'?'selected':''}>Pago</option><option value="cancelled" ${a.payment_status==='cancelled'?'selected':''}>Cancelado</option></select>`,
      actions('artist_activities',a.id)
    ]))}</div></div>`;
  document.querySelector('#artist-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('artists').insert({artistic_name:fd.get('artistic_name'),legal_name:fd.get('legal_name')||null,email:fd.get('email')||null,phone:fd.get('phone')||null,genres:fd.get('genres')||null,distributor:fd.get('distributor')||null,spotify_url:fd.get('spotify_url')||null,youtube_url:fd.get('youtube_url')||null,instagram_url:fd.get('instagram_url')||null,status:fd.get('status'),biography:fd.get('biography')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'artist-feedback');await renderArtists();});
  document.querySelector('#artist-contract-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('artist_contracts').insert({artist_id:fd.get('artist_id'),contract_type:fd.get('contract_type'),start_date:fd.get('start_date'),end_date:fd.get('end_date')||null,commission_notes:fd.get('commission_notes')||null,document_url:fd.get('document_url')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'contract-feedback');await renderArtists();});
  document.querySelector('#artist-activity-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('artist_activities').insert({artist_id:fd.get('artist_id'),activity_type:fd.get('activity_type'),title:fd.get('title'),activity_date:fd.get('activity_date')||null,organisation:fd.get('organisation')||null,location:fd.get('location')||null,gross_amount:Number(fd.get('gross_amount')||0),jeni_income:Number(fd.get('jeni_income')||0),artist_amount:Number(fd.get('artist_amount')||0),payment_status:fd.get('payment_status'),status:fd.get('status'),platform_links:fd.get('platform_links')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'activity-feedback');await renderArtists();});
  document.querySelectorAll('[data-artist-payment]').forEach(select=>select.addEventListener('change',async()=>{const{error}=await supabase.from('artist_activities').update({payment_status:select.value,updated_at:new Date().toISOString()}).eq('id',select.dataset.artistPayment);if(error)window.alert(error.message);}));
  bindActions(renderArtists);
}

async function renderMarketing() {
  const [{data:summary,error},{data:campaigns},{data:contents},{data:expenses},{data:resources}] = await Promise.all([
    supabase.from('marketing_summary').select('*').single(),
    supabase.from('marketing_campaigns').select('*').order('start_date',{ascending:false}),
    supabase.from('marketing_content').select('*,marketing_campaigns(name)').order('planned_date',{ascending:true}),
    supabase.from('marketing_expenses').select('*,marketing_campaigns(name)').order('expense_date',{ascending:false}).limit(30),
    supabase.from('marketing_resources').select('*').order('name'),
  ]);
  if(error)return showError(error);
  const campaignOptions=(campaigns||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  content.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid">${stat('Campanhas activas',summary.active_campaigns)}${stat('Publicações realizadas',summary.published_content)}
      ${stat('Aguardam aprovação',summary.awaiting_approval)}${stat('Orçamento',money(summary.total_budget))}
      ${stat('Despesas',money(summary.total_expenses))}${stat('Saldo disponível',money(summary.available_budget))}
      ${stat('Alcance total',summary.total_reach)}${stat('Visualizações',summary.total_views)}</div>
    <div class="card"><h3>Nova campanha</h3><form id="campaign-form" class="form-grid">
      <input name="name" placeholder="Nome da campanha" required><input name="objective" placeholder="Objectivo" required>
      <input name="target_audience" placeholder="Público-alvo"><input name="responsible_name" placeholder="Responsável">
      <label>Data de início<input type="date" name="start_date"></label><label>Data de término<input type="date" name="end_date"></label>
      <input type="number" name="budget" min="0" step="0.01" placeholder="Orçamento">
      <select name="status"><option value="planned">Planeada</option><option value="active">Activa</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select>
      <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar campanha</button>
    </form><div id="campaign-feedback"></div></div>
    <div class="split">
      <div class="card"><h3>Calendário de conteúdo</h3><form id="content-form" class="form-grid">
        <select name="campaign_id"><option value="">Sem campanha</option>${campaignOptions}</select><input name="title" placeholder="Título do conteúdo" required>
        <select name="content_type"><option value="post">Publicação</option><option value="video">Vídeo</option><option value="story">Story</option><option value="press_release">Comunicado de imprensa</option><option value="newsletter">Newsletter</option><option value="article">Artigo</option><option value="design">Material gráfico</option><option value="other">Outro</option></select>
        <input name="channel" placeholder="Canal: Instagram, Facebook, imprensa…" required><label>Data prevista<input type="date" name="planned_date"></label>
        <textarea name="copy_text" placeholder="Texto/legenda"></textarea><input type="url" name="asset_url" placeholder="Link do material">
        <select name="approval_status"><option value="draft">Rascunho</option><option value="review">Para aprovação da administradora</option><option value="approved">Aprovado</option><option value="published">Publicado</option></select>
        <button class="btn btn-primary">Guardar conteúdo</button></form><div id="content-feedback"></div></div>
      <div class="card"><h3>Despesa de comunicação</h3><form id="marketing-expense-form" class="form-grid">
        <select name="campaign_id"><option value="">Sem campanha</option>${campaignOptions}</select><input type="date" name="expense_date" required>
        <input name="category" placeholder="Categoria" required><input name="description" placeholder="Descrição" required>
        <input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor" required>
        <input type="url" name="receipt_url" placeholder="Link do comprovativo"><textarea name="notes" placeholder="Observações"></textarea>
        <button class="btn btn-primary">Guardar despesa</button></form><div id="marketing-expense-feedback"></div>
        <hr><h3>Imprensa ou material</h3><form id="resource-form" class="form-grid">
        <select name="resource_type"><option value="media_contact">Contacto de imprensa</option><option value="brand_asset">Material de identidade visual</option><option value="supplier">Fornecedor</option><option value="other">Outro</option></select>
        <input name="name" placeholder="Nome" required><input name="organisation" placeholder="Órgão/organização">
        <input type="email" name="email" placeholder="Email"><input name="phone" placeholder="Telefone"><input type="url" name="url" placeholder="Link do material/site">
        <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar recurso</button></form><div id="resource-feedback"></div></div>
    </div>
    <div class="card"><h3>Campanhas</h3>${actionTable(['Campanha','Objectivo','Período','Orçamento','Responsável','Estado','Acções'],(campaigns||[]).map(c=>[
      c.name,c.objective,`${c.start_date||'-'} — ${c.end_date||'-'}`,money(c.budget),c.responsible_name||'-',c.status,actions('marketing_campaigns',c.id,true)
    ]))}</div>
    <div class="card"><h3>Conteúdos e aprovação</h3>${actionTable(['Data','Campanha','Conteúdo','Canal','Estado','Alcance','Visualizações','Acções'],(contents||[]).map(c=>[
      c.planned_date||'-',c.marketing_campaigns?.name||'-',c.title,c.channel,
      `<select data-content-status="${c.id}"><option value="draft" ${c.approval_status==='draft'?'selected':''}>Rascunho</option><option value="review" ${c.approval_status==='review'?'selected':''}>Em revisão</option><option value="approved" ${c.approval_status==='approved'?'selected':''}>Aprovado</option><option value="rejected" ${c.approval_status==='rejected'?'selected':''}>Rejeitado</option><option value="published" ${c.approval_status==='published'?'selected':''}>Publicado</option></select>`,
      `<input data-metric="reach" data-id="${c.id}" type="number" min="0" value="${c.reach}" style="width:100px">`,
      `<input data-metric="views" data-id="${c.id}" type="number" min="0" value="${c.views}" style="width:100px">`,actions('marketing_content',c.id)
    ]))}</div>
    <div class="split">
      <div class="card"><h3>Despesas</h3>${actionTable(['Data','Campanha','Categoria','Valor','Comprovativo','Acções'],(expenses||[]).map(x=>[
        x.expense_date,x.marketing_campaigns?.name||'-',x.category,money(x.amount),x.receipt_url?`<a href="${x.receipt_url}" target="_blank">Abrir</a>`:'-',actions('marketing_expenses',x.id)
      ]))}</div>
      <div class="card"><h3>Imprensa e materiais</h3>${actionTable(['Tipo','Nome','Organização','Contacto/Link','Acções'],(resources||[]).map(r=>[
        r.resource_type,r.name,r.organisation||'-',r.url?`<a href="${r.url}" target="_blank">Abrir</a>`:(r.email||r.phone||'-'),actions('marketing_resources',r.id)
      ]))}</div>
    </div></div>`;
  document.querySelector('#campaign-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('marketing_campaigns').insert({name:fd.get('name'),objective:fd.get('objective'),target_audience:fd.get('target_audience')||null,responsible_name:fd.get('responsible_name')||null,start_date:fd.get('start_date')||null,end_date:fd.get('end_date')||null,budget:Number(fd.get('budget')||0),status:fd.get('status'),notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'campaign-feedback');await renderMarketing();});
  document.querySelector('#content-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const status=fd.get('approval_status');const{error}=await supabase.from('marketing_content').insert({campaign_id:fd.get('campaign_id')||null,title:fd.get('title'),content_type:fd.get('content_type'),channel:fd.get('channel'),planned_date:fd.get('planned_date')||null,copy_text:fd.get('copy_text')||null,asset_url:fd.get('asset_url')||null,approval_status:status,approved_by:['approved','published'].includes(status)?profile.id:null,approved_at:['approved','published'].includes(status)?new Date().toISOString():null,created_by:profile.id});if(error)return feedback(error.message,'content-feedback');await renderMarketing();});
  document.querySelector('#marketing-expense-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('marketing_expenses').insert({campaign_id:fd.get('campaign_id')||null,expense_date:fd.get('expense_date'),category:fd.get('category'),description:fd.get('description'),amount:Number(fd.get('amount')),receipt_url:fd.get('receipt_url')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'marketing-expense-feedback');await renderMarketing();});
  document.querySelector('#resource-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('marketing_resources').insert({resource_type:fd.get('resource_type'),name:fd.get('name'),organisation:fd.get('organisation')||null,email:fd.get('email')||null,phone:fd.get('phone')||null,url:fd.get('url')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'resource-feedback');await renderMarketing();});
  document.querySelectorAll('[data-content-status]').forEach(select=>select.addEventListener('change',async()=>{const approved=['approved','published'].includes(select.value);const payload={approval_status:select.value,approved_by:approved?profile.id:null,approved_at:approved?new Date().toISOString():null,updated_at:new Date().toISOString()};if(select.value==='published')payload.published_date=new Date().toISOString().slice(0,10);const{error}=await supabase.from('marketing_content').update(payload).eq('id',select.dataset.contentStatus);if(error)window.alert(error.message);await renderMarketing();}));
  document.querySelectorAll('[data-metric]').forEach(input=>input.addEventListener('change',async()=>{const{error}=await supabase.from('marketing_content').update({[input.dataset.metric]:Number(input.value||0),updated_at:new Date().toISOString()}).eq('id',input.dataset.id);if(error)window.alert(error.message);}));
  bindActions(renderMarketing);
}

async function renderProjects() {
  const [{data:summary,error},{data:rows},{data:expenses},{data:milestones}] = await Promise.all([
    supabase.from('projects_summary').select('*').single(),
    supabase.from('project_records').select('*').order('created_at',{ascending:false}),
    supabase.from('project_expenses').select('*,project_records(title)').order('expense_date',{ascending:false}).limit(30),
    supabase.from('project_milestones').select('*,project_records(title)').order('due_date',{ascending:true}).limit(30),
  ]);
  if(error)return showError(error);
  const projectOptions=(rows||[]).map(r=>`<option value="${r.id}">${r.title}</option>`).join('');
  content.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid">${stat('Projectos activos',summary.active_projects)}${stat('Parcerias activas',summary.active_partnerships)}
      ${stat('Candidaturas activas',summary.active_applications)}${stat('Prazos nos próximos 30 dias',summary.deadlines_30_days)}
      ${stat('Orçamento total',money(summary.total_budget))}${stat('Financiamento aprovado',money(summary.approved_funding))}
      ${stat('Despesas registadas',money(summary.total_expenses))}${stat('Saldo disponível',money(summary.available_balance))}</div>
    <div class="card"><h3>Novo registo</h3><form id="project-record-form" class="form-grid">
      <select name="record_type" required><option value="execution">Projecto em execução</option><option value="partnership">Parceria institucional</option><option value="application">Candidatura a financiamento</option></select>
      <input name="title" placeholder="Nome do projecto, parceria ou edital" required><input name="funder" placeholder="Financiador ou instituição">
      <input name="country" placeholder="País"><input name="responsible_name" placeholder="Responsável" required>
      <input name="partners_text" placeholder="Parceiros"><input name="beneficiaries" placeholder="Beneficiários ou público-alvo">
      <label>Data de início<input type="date" name="start_date"></label><label>Data de término<input type="date" name="end_date"></label>
      <label>Prazo da candidatura/entrega<input type="date" name="deadline"></label>
      <input type="number" name="total_budget" min="0" step="0.01" placeholder="Orçamento total">
      <input type="number" name="requested_amount" min="0" step="0.01" placeholder="Valor solicitado">
      <input type="number" name="approved_amount" min="0" step="0.01" placeholder="Financiamento aprovado">
      <select name="status"><option value="identified">Identificado</option><option value="preparing">Em preparação</option><option value="submitted">Submetido</option><option value="approved">Aprovado</option><option value="in_progress">Em execução</option><option value="completed">Concluído</option><option value="suspended">Suspenso</option><option value="rejected">Recusado</option><option value="cancelled">Cancelado</option></select>
      <input name="next_step" placeholder="Próximo passo" required><label>Prazo do próximo passo<input type="date" name="next_step_date"></label>
      <input type="url" name="document_url" placeholder="Link dos documentos"><input type="url" name="report_url" placeholder="Link dos relatórios">
      <textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar registo</button>
    </form><div id="project-record-feedback"></div></div>
    <div class="split">
      <div class="card"><h3>Registar despesa</h3><form id="project-expense-form" class="form-grid">
        <select name="project_id" required><option value="">Seleccionar projecto</option>${projectOptions}</select>
        <input type="date" name="expense_date" required><input name="category" placeholder="Categoria" required>
        <input name="description" placeholder="Descrição" required><input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor" required>
        <select name="payment_method"><option value="">Método de pagamento</option><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="bank_transfer">Transferência</option></select>
        <input type="url" name="receipt_url" placeholder="Link do comprovativo"><textarea name="notes" placeholder="Observações"></textarea>
        <button class="btn btn-primary">Guardar despesa</button></form><div id="project-expense-feedback"></div></div>
      <div class="card"><h3>Nova etapa ou entrega</h3><form id="milestone-form" class="form-grid">
        <select name="project_id" required><option value="">Seleccionar projecto</option>${projectOptions}</select>
        <input name="title" placeholder="Etapa, entrega ou resultado" required><input type="date" name="due_date">
        <input name="responsible_name" placeholder="Responsável"><select name="status"><option value="pending">Pendente</option><option value="in_progress">Em curso</option><option value="completed">Concluída</option><option value="delayed">Atrasada</option><option value="cancelled">Cancelada</option></select>
        <input type="url" name="document_url" placeholder="Link do documento/relatório"><textarea name="notes" placeholder="Observações"></textarea>
        <button class="btn btn-primary">Guardar etapa</button></form><div id="milestone-feedback"></div></div>
    </div>
    <div class="card"><h3>Projectos, parcerias e candidaturas</h3>${actionTable(['Tipo','Título','Financiador','Prazo','Orçamento','Aprovado','Responsável','Próximo passo','Estado','Acções'],(rows||[]).map(r=>[
      ({execution:'Projecto',partnership:'Parceria',application:'Candidatura'})[r.record_type],r.title,r.funder||'-',r.deadline||r.end_date||'-',money(r.total_budget),money(r.approved_amount),r.responsible_name,r.next_step,r.status,actions('project_records',r.id,true)
    ]))}</div>
    <div class="split">
      <div class="card"><h3>Despesas recentes</h3>${actionTable(['Data','Projecto','Categoria','Descrição','Valor','Comprovativo','Acções'],(expenses||[]).map(x=>[
        x.expense_date,x.project_records?.title||'-',x.category,x.description,money(x.amount),x.receipt_url?`<a href="${x.receipt_url}" target="_blank">Abrir</a>`:'-',actions('project_expenses',x.id)
      ]))}</div>
      <div class="card"><h3>Etapas e entregas</h3>${actionTable(['Projecto','Etapa','Prazo','Responsável','Estado','Acções'],(milestones||[]).map(m=>[
        m.project_records?.title||'-',m.title,m.due_date||'-',m.responsible_name||'-',m.status,actions('project_milestones',m.id,true)
      ]))}</div>
    </div></div>`;
  document.querySelector('#project-record-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('project_records').insert({record_type:fd.get('record_type'),title:fd.get('title'),funder:fd.get('funder')||null,country:fd.get('country')||null,responsible_name:fd.get('responsible_name'),partners_text:fd.get('partners_text')||null,beneficiaries:fd.get('beneficiaries')||null,start_date:fd.get('start_date')||null,end_date:fd.get('end_date')||null,deadline:fd.get('deadline')||null,total_budget:Number(fd.get('total_budget')||0),requested_amount:Number(fd.get('requested_amount')||0),approved_amount:Number(fd.get('approved_amount')||0),status:fd.get('status'),next_step:fd.get('next_step'),next_step_date:fd.get('next_step_date')||null,document_url:fd.get('document_url')||null,report_url:fd.get('report_url')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'project-record-feedback');await renderProjects();});
  document.querySelector('#project-expense-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('project_expenses').insert({project_id:fd.get('project_id'),expense_date:fd.get('expense_date'),category:fd.get('category'),description:fd.get('description'),amount:Number(fd.get('amount')),payment_method:fd.get('payment_method')||null,receipt_url:fd.get('receipt_url')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'project-expense-feedback');await renderProjects();});
  document.querySelector('#milestone-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('project_milestones').insert({project_id:fd.get('project_id'),title:fd.get('title'),due_date:fd.get('due_date')||null,responsible_name:fd.get('responsible_name')||null,status:fd.get('status'),document_url:fd.get('document_url')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'milestone-feedback');await renderProjects();});
  bindActions(renderProjects);
}

async function renderHumanResources() {
  const [{data:s,error},{data:employees},{data:contracts},{data:absences},{data:reviews},{data:trainings},{data:movements},{data:documents}] = await Promise.all([
    supabase.from('hr_summary').select('*').single(),
    supabase.from('hr_employees').select('*').order('full_name'),
    supabase.from('hr_contracts').select('*,hr_employees(full_name)').order('end_date'),
    supabase.from('hr_absences').select('*,hr_employees(full_name)').order('start_date',{ascending:false}),
    supabase.from('hr_reviews').select('*,hr_employees(full_name)').order('review_date',{ascending:false}),
    supabase.from('hr_trainings').select('*,hr_employees(full_name)').order('training_date',{ascending:false}),
    supabase.from('hr_movements').select('*,hr_employees(full_name)').order('movement_date',{ascending:false}),
    supabase.from('hr_documents').select('*,hr_employees(full_name)').order('created_at',{ascending:false})
  ]);
  if(error)return showError(error);
  const opts=(employees||[]).filter(e=>e.status==='active').map(e=>`<option value="${e.id}">${e.full_name}</option>`).join('');
  content.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid">${stat('Colaboradores activos',s.active_employees)}${stat('Contratos a terminar (60 dias)',s.expiring_contracts)}
      ${stat('Férias e ausências actuais',s.current_absences)}${stat('Aniversários do mês',s.birthdays_month)}
      ${stat('Avaliações pendentes',s.pending_reviews)}${stat('Formações pendentes',s.pending_trainings)}</div>
    <div class="card"><h3>Cadastrar colaborador</h3><form id="hr-employee-form" class="form-grid">
      <input name="full_name" placeholder="Nome completo" required><input name="employee_number" placeholder="Número do colaborador">
      <input type="date" name="birth_date" title="Data de nascimento"><select name="gender"><option value="">Género</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="other">Outro</option></select>
      <input name="phone" placeholder="Telefone"><input type="email" name="email" placeholder="Email">
      <input name="address" placeholder="Endereço"><input name="emergency_contact" placeholder="Contacto de emergência">
      <input name="department" placeholder="Departamento" required><input name="job_title" placeholder="Cargo" required>
      <input type="date" name="hire_date" title="Data de admissão" required><select name="employment_type"><option value="employee">Efectivo</option><option value="fixed_term">Prazo certo</option><option value="intern">Estagiário</option><option value="consultant">Consultor</option><option value="volunteer">Voluntário</option></select>
      <input type="number" name="base_salary" min="0" step="0.01" placeholder="Salário base"><input name="nuit" placeholder="NUIT">
      <input name="bank_details" placeholder="Dados bancários"><textarea name="notes" placeholder="Observações"></textarea>
      <button class="btn btn-primary">Guardar colaborador</button></form><div id="hr-employee-feedback"></div></div>
    <div class="split">
      <div class="card"><h3>Contrato</h3><form id="hr-contract-form" class="form-grid">
        <select name="employee_id" required><option value="">Colaborador</option>${opts}</select><select name="contract_type"><option value="permanent">Sem termo</option><option value="fixed_term">Prazo certo</option><option value="internship">Estágio</option><option value="consultancy">Consultoria</option><option value="other">Outro</option></select>
        <input type="date" name="start_date" required><input type="date" name="end_date"><input type="number" name="salary" min="0" step="0.01" placeholder="Salário">
        <input type="url" name="document_url" placeholder="Link do contrato"><select name="status"><option value="active">Activo</option><option value="pending">Pendente</option><option value="ended">Terminado</option><option value="cancelled">Cancelado</option></select>
        <textarea name="notes" placeholder="Condições/observações"></textarea><button class="btn btn-primary">Guardar contrato</button></form><div id="hr-contract-feedback"></div></div>
      <div class="card"><h3>Férias, falta ou licença</h3><form id="hr-absence-form" class="form-grid">
        <select name="employee_id" required><option value="">Colaborador</option>${opts}</select><select name="absence_type"><option value="vacation">Férias</option><option value="sick_leave">Baixa médica</option><option value="justified_absence">Falta justificada</option><option value="unjustified_absence">Falta injustificada</option><option value="maternity">Licença de maternidade</option><option value="other">Outra</option></select>
        <input type="date" name="start_date" required><input type="date" name="end_date" required><select name="status"><option value="requested">Solicitada</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option><option value="completed">Concluída</option></select>
        <input type="url" name="document_url" placeholder="Comprovativo/documento"><textarea name="notes" placeholder="Observações"></textarea><button class="btn btn-primary">Guardar ausência</button></form><div id="hr-absence-feedback"></div></div>
    </div>
    <div class="split">
      <div class="card"><h3>Avaliação de desempenho</h3><form id="hr-review-form" class="form-grid">
        <select name="employee_id" required><option value="">Colaborador</option>${opts}</select><input type="date" name="review_date" required><input name="reviewer_name" placeholder="Avaliador" required>
        <input type="number" name="score" min="0" max="100" placeholder="Pontuação (0–100)"><input type="date" name="next_review_date" title="Próxima avaliação">
        <textarea name="strengths" placeholder="Pontos fortes"></textarea><textarea name="improvements" placeholder="Pontos a melhorar e metas"></textarea><button class="btn btn-primary">Guardar avaliação</button></form><div id="hr-review-feedback"></div></div>
      <div class="card"><h3>Formação</h3><form id="hr-training-form" class="form-grid">
        <select name="employee_id" required><option value="">Colaborador</option>${opts}</select><input name="title" placeholder="Formação" required><input name="provider" placeholder="Entidade formadora">
        <input type="date" name="training_date"><input type="number" name="cost" min="0" step="0.01" placeholder="Custo"><select name="status"><option value="planned">Planeada</option><option value="in_progress">Em curso</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select>
        <input type="url" name="certificate_url" placeholder="Certificado/documento"><textarea name="notes" placeholder="Objectivos/observações"></textarea><button class="btn btn-primary">Guardar formação</button></form><div id="hr-training-feedback"></div></div>
    </div>
    <div class="split">
      <div class="card"><h3>Movimento de pessoal</h3><form id="hr-movement-form" class="form-grid">
        <select name="employee_id" required><option value="">Colaborador</option>${opts}</select><select name="movement_type"><option value="admission">Admissão/integração</option><option value="renewal">Renovação</option><option value="promotion">Promoção</option><option value="job_change">Mudança de cargo</option><option value="warning">Advertência</option><option value="disciplinary">Processo disciplinar</option><option value="termination">Saída/rescisão</option></select>
        <input type="date" name="movement_date" required><input name="previous_position" placeholder="Cargo anterior"><input name="new_position" placeholder="Novo cargo">
        <input type="url" name="document_url" placeholder="Documento"><textarea name="reason" placeholder="Motivo/decisão" required></textarea><button class="btn btn-primary">Guardar movimento</button></form><div id="hr-movement-feedback"></div></div>
      <div class="card"><h3>Documento do colaborador</h3><form id="hr-document-form" class="form-grid">
        <select name="employee_id" required><option value="">Colaborador</option>${opts}</select><input name="document_type" placeholder="Tipo de documento" required><input name="title" placeholder="Título" required>
        <input type="date" name="expiry_date" title="Validade"><input type="url" name="document_url" placeholder="Link do documento" required><textarea name="notes" placeholder="Observações"></textarea>
        <button class="btn btn-primary">Guardar documento</button></form><div id="hr-document-feedback"></div></div>
    </div>
    <div class="card"><h3>Colaboradores</h3>${actionTable(['Nome','Departamento','Cargo','Admissão','Salário','Estado','Acções'],(employees||[]).map(e=>[e.full_name,e.department,e.job_title,e.hire_date,money(e.base_salary),e.status,actions('hr_employees',e.id,true)]))}</div>
    <div class="card"><h3>Contratos</h3>${actionTable(['Colaborador','Tipo','Início','Fim','Salário','Estado','Acções'],(contracts||[]).map(r=>[r.hr_employees?.full_name||'-',r.contract_type,r.start_date,r.end_date||'-',money(r.salary),r.status,actions('hr_contracts',r.id)]))}</div>
    <div class="card"><h3>Férias e ausências</h3>${actionTable(['Colaborador','Tipo','Início','Fim','Estado','Acções'],(absences||[]).map(r=>[r.hr_employees?.full_name||'-',r.absence_type,r.start_date,r.end_date,r.status,actions('hr_absences',r.id)]))}</div>
    <div class="card"><h3>Avaliações e formações</h3>${simpleTable(['Colaborador','Registo','Data','Estado/Resultado'],[...(reviews||[]).map(r=>[r.hr_employees?.full_name||'-','Avaliação',r.review_date,r.score===null?'-':r.score+'/100']),...(trainings||[]).map(r=>[r.hr_employees?.full_name||'-',r.title,r.training_date||'-',r.status])])}</div>
    <div class="card"><h3>Movimentos e documentos</h3>${actionTable(['Colaborador','Tipo','Data/validade','Descrição','Acções'],[...(movements||[]).map(r=>[r.hr_employees?.full_name||'-',r.movement_type,r.movement_date,r.reason,actions('hr_movements',r.id)]),...(documents||[]).map(r=>[r.hr_employees?.full_name||'-',r.document_type,r.expiry_date||'-',r.title,actions('hr_documents',r.id)])])}</div>
  </div>`;
  const forms=[
    ['#hr-employee-form','hr_employees',fd=>({full_name:fd.get('full_name'),employee_number:fd.get('employee_number')||null,birth_date:fd.get('birth_date')||null,gender:fd.get('gender')||null,phone:fd.get('phone')||null,email:fd.get('email')||null,address:fd.get('address')||null,emergency_contact:fd.get('emergency_contact')||null,department:fd.get('department'),job_title:fd.get('job_title'),hire_date:fd.get('hire_date'),employment_type:fd.get('employment_type'),base_salary:Number(fd.get('base_salary')||0),nuit:fd.get('nuit')||null,bank_details:fd.get('bank_details')||null,notes:fd.get('notes')||null,created_by:profile.id}),'hr-employee-feedback'],
    ['#hr-contract-form','hr_contracts',fd=>({employee_id:fd.get('employee_id'),contract_type:fd.get('contract_type'),start_date:fd.get('start_date'),end_date:fd.get('end_date')||null,salary:Number(fd.get('salary')||0),document_url:fd.get('document_url')||null,status:fd.get('status'),notes:fd.get('notes')||null,created_by:profile.id}),'hr-contract-feedback'],
    ['#hr-absence-form','hr_absences',fd=>({employee_id:fd.get('employee_id'),absence_type:fd.get('absence_type'),start_date:fd.get('start_date'),end_date:fd.get('end_date'),status:fd.get('status'),document_url:fd.get('document_url')||null,notes:fd.get('notes')||null,created_by:profile.id}),'hr-absence-feedback'],
    ['#hr-review-form','hr_reviews',fd=>({employee_id:fd.get('employee_id'),review_date:fd.get('review_date'),reviewer_name:fd.get('reviewer_name'),score:fd.get('score')?Number(fd.get('score')):null,next_review_date:fd.get('next_review_date')||null,strengths:fd.get('strengths')||null,improvements:fd.get('improvements')||null,created_by:profile.id}),'hr-review-feedback'],
    ['#hr-training-form','hr_trainings',fd=>({employee_id:fd.get('employee_id'),title:fd.get('title'),provider:fd.get('provider')||null,training_date:fd.get('training_date')||null,cost:Number(fd.get('cost')||0),status:fd.get('status'),certificate_url:fd.get('certificate_url')||null,notes:fd.get('notes')||null,created_by:profile.id}),'hr-training-feedback'],
    ['#hr-movement-form','hr_movements',fd=>({employee_id:fd.get('employee_id'),movement_type:fd.get('movement_type'),movement_date:fd.get('movement_date'),previous_position:fd.get('previous_position')||null,new_position:fd.get('new_position')||null,document_url:fd.get('document_url')||null,reason:fd.get('reason'),created_by:profile.id}),'hr-movement-feedback'],
    ['#hr-document-form','hr_documents',fd=>({employee_id:fd.get('employee_id'),document_type:fd.get('document_type'),title:fd.get('title'),expiry_date:fd.get('expiry_date')||null,document_url:fd.get('document_url'),notes:fd.get('notes')||null,created_by:profile.id}),'hr-document-feedback']
  ];
  forms.forEach(([selector,table,payload,id])=>document.querySelector(selector).addEventListener('submit',async e=>{e.preventDefault();const{error}=await supabase.from(table).insert(payload(new FormData(e.currentTarget)));if(error)return feedback(error.message,id);await renderHumanResources();}));
  bindActions(renderHumanResources);
}

async function renderTasks() {
  const [{data:summary,error},{data:tasks},{data:users},{data:events},{data:comments},{data:projects},{data:artists},{data:campaigns}] = await Promise.all([
    supabase.from('tasks_agenda_summary').select('*').single(),
    supabase.from('company_tasks').select('*,profiles!company_tasks_assigned_to_fkey(full_name,email)').order('due_date'),
    supabase.from('profiles').select('id,full_name,email').eq('is_active',true),
    supabase.from('agenda_events').select('*,profiles!agenda_events_responsible_id_fkey(full_name,email)').order('event_date').limit(40),
    supabase.from('task_comments').select('*').order('created_at',{ascending:false}).limit(30),
    supabase.from('project_records').select('id,title').order('title'),
    supabase.from('artists').select('id,artistic_name').eq('status','active'),
    supabase.from('marketing_campaigns').select('id,name').order('name')
  ]);
  if(error) return showError(error);
  const userOptions=(users||[]).map(u=>`<option value="${u.id}">${validIdentity(u.full_name)||validIdentity(u.email)||'Utilizador'}</option>`).join('');
  const projectOptions=(projects||[]).map(p=>`<option value="${p.id}">${p.title}</option>`).join('');
  const artistOptions=(artists||[]).map(a=>`<option value="${a.id}">${a.artistic_name}</option>`).join('');
  const campaignOptions=(campaigns||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  content.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid">${stat('Tarefas de hoje',summary.tasks_today)}${stat('Tarefas atrasadas',summary.overdue_tasks)}
      ${stat('Agenda de hoje',summary.events_today)}${stat('Agenda da semana',summary.events_week)}
      ${stat('Tarefas abertas',summary.open_tasks)}${stat('Tarefas concluídas',summary.completed_tasks)}</div>
    <div class="card"><h3>Atribuir tarefa ou subtarefa</h3><form id="task-form" class="form-grid">
      <input name="title" placeholder="Tarefa" required><select name="assigned_to" required><option value="">Responsável</option>${userOptions}</select>
      <input type="date" name="due_date"><select name="priority"><option value="normal">Prioridade normal</option><option value="high">Alta</option><option value="low">Baixa</option></select>
      <select name="department"><option value="">Departamento</option><option value="direccao">Direcção</option><option value="financeiro">Financeiro</option><option value="projectos">Projectos</option><option value="marketing">Marketing</option><option value="artistas">Artistas</option><option value="avicultura">Avicultura</option><option value="recursos-humanos">Recursos Humanos</option></select>
      <select name="parent_task_id"><option value="">Tarefa principal</option>${(tasks||[]).filter(t=>!t.parent_task_id).map(t=>`<option value="${t.id}">Subtarefa de: ${t.title}</option>`).join('')}</select>
      <select name="project_record_id"><option value="">Sem projecto</option>${projectOptions}</select><select name="artist_id"><option value="">Sem artista</option>${artistOptions}</select>
      <select name="campaign_id"><option value="">Sem campanha</option>${campaignOptions}</select>
      <select name="recurrence"><option value="none">Não repetir</option><option value="daily">Diariamente</option><option value="weekly">Semanalmente</option><option value="monthly">Mensalmente</option><option value="yearly">Anualmente</option></select>
      <input type="date" name="recurrence_end" title="Fim da repetição"><input type="url" name="document_url" placeholder="Link do documento">
      <textarea name="description" placeholder="Descrição"></textarea><button class="btn btn-primary">Atribuir</button></form><div id="task-feedback"></div></div>
    <div class="split"><div class="card"><h3>Reunião, evento ou lembrete</h3><form id="event-form" class="form-grid">
      <input name="title" placeholder="Título" required><select name="event_type"><option value="meeting">Reunião</option><option value="event">Evento</option><option value="deadline">Prazo</option><option value="reminder">Lembrete</option><option value="other">Outro</option></select>
      <input type="date" name="event_date" required><input type="time" name="start_time"><input type="time" name="end_time"><input name="location" placeholder="Local ou link">
      <select name="responsible_id"><option value="">Responsável</option>${userOptions}</select><select name="department"><option value="">Departamento</option><option value="direccao">Direcção</option><option value="financeiro">Financeiro</option><option value="projectos">Projectos</option><option value="marketing">Marketing</option><option value="artistas">Artistas</option><option value="avicultura">Avicultura</option><option value="recursos-humanos">Recursos Humanos</option></select>
      <select name="project_record_id"><option value="">Sem projecto</option>${projectOptions}</select><select name="artist_id"><option value="">Sem artista</option>${artistOptions}</select>
      <select name="campaign_id"><option value="">Sem campanha</option>${campaignOptions}</select><select name="recurrence"><option value="none">Não repetir</option><option value="daily">Diariamente</option><option value="weekly">Semanalmente</option><option value="monthly">Mensalmente</option><option value="yearly">Anualmente</option></select>
      <input type="date" name="recurrence_end"><input type="url" name="document_url" placeholder="Link do documento"><textarea name="notes" placeholder="Agenda/observações"></textarea>
      <button class="btn btn-primary">Guardar na agenda</button></form><div id="event-feedback"></div></div>
    <div class="card"><h3>Comentário ou actualização</h3><form id="comment-form" class="form-grid">
      <select name="task_id" required><option value="">Seleccionar tarefa</option>${(tasks||[]).map(t=>`<option value="${t.id}">${t.title}</option>`).join('')}</select>
      <textarea name="comment_text" placeholder="Comentário ou progresso" required></textarea><button class="btn btn-primary">Adicionar</button></form><div id="comment-feedback"></div>
      <h3>Actualizações recentes</h3>${simpleTable(['Quando','Actualização'],(comments||[]).map(c=>[new Date(c.created_at).toLocaleString('pt-PT'),c.comment_text]))}</div></div>
    <div class="card"><h3>Tarefas</h3>${actionTable(['Tarefa','Responsável','Prazo','Prioridade','Estado','Acções'],(tasks||[]).map(t=>[
      `${t.parent_task_id?'↳ ':''}${t.title}`,validIdentity(t.profiles?.full_name)||validIdentity(t.profiles?.email)||'-',t.due_date||'-',`${t.priority}${t.recurrence&&t.recurrence!=='none'?` · ${t.recurrence}`:''}`,
      `<select data-status-table="company_tasks" data-id="${t.id}"><option value="pending" ${t.status==='pending'?'selected':''}>Pendente</option><option value="in_progress" ${t.status==='in_progress'?'selected':''}>Em curso</option><option value="completed" ${t.status==='completed'?'selected':''}>Concluída</option><option value="cancelled" ${t.status==='cancelled'?'selected':''}>Cancelada</option></select>`,
      actions('company_tasks',t.id)
    ]))}</div>
    <div class="card"><h3>Agenda</h3>${actionTable(['Data','Hora','Tipo','Evento','Local','Responsável','Estado','Acções'],(events||[]).map(ev=>[
      ev.event_date,ev.start_time?.slice(0,5)||'-',ev.event_type,ev.title,ev.location||'-',validIdentity(ev.profiles?.full_name)||validIdentity(ev.profiles?.email)||'-',
      `<select data-event-status="${ev.id}"><option value="scheduled" ${ev.status==='scheduled'?'selected':''}>Agendado</option><option value="completed" ${ev.status==='completed'?'selected':''}>Realizado</option><option value="cancelled" ${ev.status==='cancelled'?'selected':''}>Cancelado</option></select>`,actions('agenda_events',ev.id)
    ]))}</div></div>`;
  document.querySelector('#task-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('company_tasks').insert({title:fd.get('title'),assigned_to:fd.get('assigned_to'),due_date:fd.get('due_date')||null,priority:fd.get('priority'),department:fd.get('department')||null,parent_task_id:fd.get('parent_task_id')||null,project_record_id:fd.get('project_record_id')||null,artist_id:fd.get('artist_id')||null,campaign_id:fd.get('campaign_id')||null,recurrence:fd.get('recurrence'),recurrence_end:fd.get('recurrence_end')||null,document_url:fd.get('document_url')||null,description:fd.get('description')||null,created_by:profile.id});if(error)return feedback(error.message,'task-feedback');await renderTasks();});
  document.querySelector('#event-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('agenda_events').insert({title:fd.get('title'),event_type:fd.get('event_type'),event_date:fd.get('event_date'),start_time:fd.get('start_time')||null,end_time:fd.get('end_time')||null,location:fd.get('location')||null,responsible_id:fd.get('responsible_id')||null,department:fd.get('department')||null,project_record_id:fd.get('project_record_id')||null,artist_id:fd.get('artist_id')||null,campaign_id:fd.get('campaign_id')||null,recurrence:fd.get('recurrence'),recurrence_end:fd.get('recurrence_end')||null,document_url:fd.get('document_url')||null,notes:fd.get('notes')||null,created_by:profile.id});if(error)return feedback(error.message,'event-feedback');await renderTasks();});
  document.querySelector('#comment-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const{error}=await supabase.from('task_comments').insert({task_id:fd.get('task_id'),comment_text:fd.get('comment_text'),created_by:profile.id});if(error)return feedback(error.message,'comment-feedback');await renderTasks();});
  document.querySelectorAll('[data-status-table]').forEach(select=>select.addEventListener('change',async()=>{const payload={status:select.value,completed_at:select.value==='completed'?new Date().toISOString():null};const{error}=await supabase.from(select.dataset.statusTable).update(payload).eq('id',select.dataset.id);if(error)window.alert(error.message);await renderTasks();}));
  document.querySelectorAll('[data-event-status]').forEach(select=>select.addEventListener('change',async()=>{const{error}=await supabase.from('agenda_events').update({status:select.value,updated_at:new Date().toISOString()}).eq('id',select.dataset.eventStatus);if(error)window.alert(error.message);await renderTasks();}));
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
    const field={partners:'full_name',institutional_transactions:'description',funding_opportunities:'title',department_records:'title',company_tasks:'title',artists:'artistic_name',artist_contracts:'commission_notes',artist_activities:'title',project_records:'title',project_expenses:'description',project_milestones:'title',marketing_campaigns:'name',marketing_content:'title',marketing_expenses:'description',marketing_resources:'name',agenda_events:'title',hr_employees:'full_name',hr_contracts:'contract_type',hr_absences:'absence_type',hr_movements:'reason',hr_documents:'title',finance_accounts:'account_name',finance_obligations:'description',finance_transfers:'notes',finance_advances:'purpose'}[table];
    const{data,error:readError}=await supabase.from(table).select(field).eq('id',button.dataset.id).single();
    if(readError)return window.alert(readError.message);
    const value=window.prompt('Introduza o novo conteúdo:',data[field]);
    if(value===null||!value.trim())return;
    const updatePayload={[field]:value.trim()};
    if(['institutional_transactions','funding_opportunities','department_records','artists','artist_contracts','artist_activities','project_records','marketing_campaigns','marketing_content','agenda_events','hr_employees'].includes(table))updatePayload.updated_at=new Date().toISOString();
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
    const field=['partners','finance_accounts'].includes(table)?'is_active':'status';
    let value;
    if(table==='finance_accounts'){const{data}=await supabase.from(table).select('is_active').eq('id',button.dataset.id).single();value=!data.is_active;
    }else if(table==='partners'){
      const{data}=await supabase.from(table).select('is_active').eq('id',button.dataset.id).single();value=!data.is_active;
    }else{
      const{data}=await supabase.from(table).select('status').eq('id',button.dataset.id).single();
      const cycles={
        project_records:{identified:'preparing',preparing:'submitted',submitted:'approved',approved:'in_progress',in_progress:'completed',completed:'in_progress',suspended:'in_progress',rejected:'identified',cancelled:'identified'},
        project_milestones:{pending:'in_progress',in_progress:'completed',completed:'pending',delayed:'in_progress',cancelled:'pending'},
        funding_opportunities:{identified:'preparing',preparing:'submitted',submitted:'approved',approved:'identified',rejected:'identified'},
        department_records:{planned:'in_progress',in_progress:'completed',completed:'planned',cancelled:'planned'},
        marketing_campaigns:{planned:'active',active:'completed',completed:'planned',cancelled:'planned'},
        hr_employees:{active:'inactive',inactive:'active',on_leave:'active',terminated:'inactive'},
      };
      value=cycles[table]?.[data.status]||data.status;
    }
    const updatePayload={[field]:value};
    if(['institutional_transactions','funding_opportunities','department_records','artists','artist_contracts','artist_activities','project_records','marketing_campaigns','marketing_content','agenda_events'].includes(table))updatePayload.updated_at=new Date().toISOString();
    const{error}=await supabase.from(table).update(updatePayload).eq('id',button.dataset.id);
    if(error)return window.alert(error.message);await rerender();
  }));
}
function feedback(message,id='record-feedback'){const el=document.querySelector(`#${id}`);if(el)el.innerHTML=`<div class="feedback error">${message}</div>`;}
function showError(error){content.innerHTML=`<div class="card"><h3>Não foi possível carregar</h3><div class="feedback error">${error.message}</div></div>`;}

await init();
