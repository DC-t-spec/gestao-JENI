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
  if (key === 'artistas') return renderArtists();
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
    const field={partners:'full_name',institutional_transactions:'description',funding_opportunities:'title',department_records:'title',company_tasks:'title',artists:'artistic_name',artist_contracts:'commission_notes',artist_activities:'title',project_records:'title',project_expenses:'description',project_milestones:'title'}[table];
    const{data,error:readError}=await supabase.from(table).select(field).eq('id',button.dataset.id).single();
    if(readError)return window.alert(readError.message);
    const value=window.prompt('Introduza o novo conteúdo:',data[field]);
    if(value===null||!value.trim())return;
    const updatePayload={[field]:value.trim()};
    if(['institutional_transactions','funding_opportunities','department_records','artists','artist_contracts','artist_activities','project_records'].includes(table))updatePayload.updated_at=new Date().toISOString();
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
      const cycles={
        project_records:{identified:'preparing',preparing:'submitted',submitted:'approved',approved:'in_progress',in_progress:'completed',completed:'in_progress',suspended:'in_progress',rejected:'identified',cancelled:'identified'},
        project_milestones:{pending:'in_progress',in_progress:'completed',completed:'pending',delayed:'in_progress',cancelled:'pending'},
        funding_opportunities:{identified:'preparing',preparing:'submitted',submitted:'approved',approved:'identified',rejected:'identified'},
        department_records:{planned:'in_progress',in_progress:'completed',completed:'planned',cancelled:'planned'},
      };
      value=cycles[table]?.[data.status]||data.status;
    }
    const updatePayload={[field]:value};
    if(['institutional_transactions','funding_opportunities','department_records','artists','artist_contracts','artist_activities','project_records'].includes(table))updatePayload.updated_at=new Date().toISOString();
    const{error}=await supabase.from(table).update(updatePayload).eq('id',button.dataset.id);
    if(error)return window.alert(error.message);await rerender();
  }));
}
function feedback(message,id='record-feedback'){const el=document.querySelector(`#${id}`);if(el)el.innerHTML=`<div class="feedback error">${message}</div>`;}
function showError(error){content.innerHTML=`<div class="card"><h3>Não foi possível carregar</h3><div class="feedback error">${error.message}</div></div>`;}

await init();
