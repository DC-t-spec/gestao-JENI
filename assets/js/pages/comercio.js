import { supabase } from '../core/supabase-client.js';
import { formatMoney } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
const input = (label, name, type='text', extra='') => `<div class="field"><label>${label}<input name="${name}" type="${type}" ${extra} required></label></div>`;

export async function renderRetail(area) {
  setPageHeader(area === 'papelaria' ? 'Papelaria' : 'Gelinhos e Kbom', 'Produtos, stock, vendas e valores por receber');
  dom.pageContent.innerHTML = '<div class="card">A carregar…</div>';
  const products = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('retail_stock').select('*').eq('area',area).order('name').order('id').range(offset,offset+499);
    if(error) {
      dom.pageContent.innerHTML = `<div class="card"><h3>Não foi possível carregar esta área</h3><p>Se esta área ainda não foi configurada, aplique supabase/20261019_comercio_e_receitas.sql no Supabase.</p><div class="feedback error">${escape(error.message)}</div></div>`;
      return;
    }
    products.push(...data);
    if (data.length < 500) break;
  }
  const ids = products.map(p=>p.id);
  let movements = [];
  // Paginação: os totais não podem ficar limitados à primeira página do Supabase.
  for(let offset=0;ids.length;offset+=500) {
    const result = await supabase.from('retail_movements').select('*').in('product_id',ids).order('created_at',{ascending:false}).order('id').range(offset,offset+499);
    if(result.error) { dom.pageContent.innerHTML=`<div class="feedback error">${escape(result.error.message)}</div>`; return; }
    movements.push(...result.data);
    if(result.data.length<500) break;
  }
  const sales=movements.filter(m=>m.kind==='sale');
  const revenue=sales.reduce((n,s)=>n+Number(s.amount_paid),0);
  const due=sales.reduce((n,s)=>n+Number(s.total_amount)-Number(s.amount_paid),0);
  const options=products.map(p=>`<option value="${p.id}">${escape(p.name)} (stock: ${p.stock})</option>`).join('');
  const names=new Map(products.map(p=>[p.id,p.name]));
  dom.pageContent.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid"><div class="card stat"><h4>Receita recebida</h4><strong>${formatMoney(revenue)}</strong></div><div class="card stat"><h4>Por receber</h4><strong>${formatMoney(due)}</strong></div><div class="card stat"><h4>Produtos</h4><strong>${products.length}</strong></div></div>
    <div id="retail-feedback" role="status"></div>
    <div class="split"><div class="card"><h3>Registar produto</h3><form id="retail-product" class="form-grid">${input('Nome / marca / sabor','name','text','maxlength="120"')}${input('Preço de venda (MZN)','unit_price','number','min="0" step="0.01"')}<button class="btn btn-primary">Guardar produto</button></form></div>
    <div class="card"><h3>Stock actual</h3><div class="table-wrap"><table><thead><tr><th>Produto</th><th>Stock</th><th>Preço</th></tr></thead><tbody>${products.map(p=>`<tr><td>${escape(p.name)}</td><td>${p.stock}</td><td>${formatMoney(p.unit_price)}</td></tr>`).join('')||'<tr><td colspan="3">Registe o primeiro produto.</td></tr>'}</tbody></table></div></div></div>
    <div class="card"><h3>Registar movimento</h3><form id="retail-movement" class="form-grid"><div class="field"><label>Produto<select name="product_id" required><option value="">Seleccionar produto</option>${options}</select></label></div><div class="field"><label>Tipo<select name="kind"><option value="entry">Entrada / produção</option><option value="sale">Venda</option><option value="loss">Perda / quebra</option></select></label></div>${input('Data','date','date',`value="${today()}"`)}${input('Quantidade','quantity','number','min="1" step="1"')}<div id="retail-sale-fields" class="field full" hidden><div class="form-grid">${input('Cliente','customer')}${input('Preço unitário (MZN)','price','number','min="0" step="0.01"')}${input('Valor pago agora (MZN)','paid','number','min="0" step="0.01" value="0"')}<p>O valor restante permanece por receber.</p></div></div><div class="field full"><label>Observações<textarea name="notes"></textarea></label></div><button class="btn btn-primary" ${products.length?'':'disabled'}>Guardar movimento</button></form></div>
    <div class="card"><h3>Pagamentos pendentes</h3><form id="retail-payment" class="form-grid"><div class="field"><label>Venda<select name="sale_id" required><option value="">Seleccionar dívida</option>${sales.filter(s=>Number(s.amount_paid)<Number(s.total_amount)).map(s=>`<option value="${s.id}">${escape(s.customer_name)} — ${escape(names.get(s.product_id))} — ${s.movement_date} — ${formatMoney(Number(s.total_amount)-Number(s.amount_paid))}</option>`).join('')}</select></label></div>${input('Data','date','date',`value="${today()}"`)}${input('Valor recebido (MZN)','amount','number','min="0.01" step="0.01"')}<button class="btn btn-primary">Registar pagamento</button></form></div>
    <div class="card"><h3>Movimentos recentes</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Cliente</th><th>Total</th><th>Recebido</th><th>Por receber</th><th>Observações</th></tr></thead><tbody>${movements.slice(0,50).map(m=>`<tr><td>${escape(m.movement_date)}</td><td>${escape(names.get(m.product_id))}</td><td>${{entry:'Entrada',sale:'Venda',loss:'Perda'}[m.kind]}</td><td>${m.quantity}</td><td>${escape(m.customer_name||'-')}</td><td>${formatMoney(m.total_amount)}</td><td>${formatMoney(m.amount_paid)}</td><td>${formatMoney(Number(m.total_amount)-Number(m.amount_paid))}</td><td>${escape(m.notes||'-')}</td></tr>`).join('')||'<tr><td colspan="9">Sem movimentos.</td></tr>'}</tbody></table></div></div></div>`;
  const form=document.querySelector('#retail-movement');
  const refreshFields=()=>{
    const sale=form.elements.kind.value==='sale';
    document.querySelector('#retail-sale-fields').hidden=!sale;
    ['customer','price','paid'].forEach(name=>{form.elements[name].disabled=!sale;});
    form.elements.price.value=products.find(p=>p.id===form.elements.product_id.value)?.unit_price??'';
  };
  form.elements.kind.addEventListener('change',refreshFields);
  form.elements.product_id.addEventListener('change',refreshFields);
  refreshFields();
  bind('#retail-product',async fd=>supabase.from('retail_products').insert({area,name:String(fd.get('name')).trim(),unit_price:Number(fd.get('unit_price'))}),area);
  bind('#retail-movement',async fd=>supabase.rpc('register_retail_movement',{
    p_product:fd.get('product_id'),p_date:fd.get('date'),p_kind:fd.get('kind'),p_quantity:Number(fd.get('quantity')),
    p_price:Number(fd.get('price')||0),p_paid:Number(fd.get('paid')||0),p_customer:fd.get('customer')||null,p_notes:fd.get('notes')||null,
  }),area);
  bind('#retail-payment',async fd=>supabase.rpc('register_retail_payment',{p_sale:fd.get('sale_id'),p_date:fd.get('date'),p_amount:Number(fd.get('amount'))}),area);
}
function bind(selector,save,area) {
  document.querySelector(selector).addEventListener('submit',async event=>{
    event.preventDefault(); const button=event.currentTarget.querySelector('button');
    if(button.disabled) return;
    button.disabled=true;
    try { const {error}=await save(new FormData(event.currentTarget)); if(error) throw error; await renderRetail(area); }
    catch(error) {showFeedback(document.querySelector('#retail-feedback'),error.message,'error');}
    finally {button.disabled=false;}
  });
}
