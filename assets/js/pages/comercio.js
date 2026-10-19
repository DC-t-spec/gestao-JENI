import { supabase } from '../core/supabase-client.js';
import { formatMoney } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
const input = (label, name, type='text', extra='') => `<div class="field"><label>${label}<input name="${name}" type="${type}" ${extra} required></label></div>`;

export async function renderRetail(area, initialTab = null) {
  setPageHeader(area === 'papelaria' ? 'Papelaria' : 'Gelinhos e Kbom', 'Produtos, stock, vendas e valores por receber');
  dom.pageContent.innerHTML = '<div class="card">A carregar…</div>';
  const products = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('retail_stock').select('*').eq('area',area).order('name').order('id').range(offset,offset+499);
    if(error) {
      dom.pageContent.innerHTML = `<div class="card"><h3>Não foi possível carregar esta área</h3><p>Se esta área ainda não foi configurada, aplique supabase/20261019_comercio_e_receitas.sql e 20261019_custos_comercio.sql no Supabase.</p><div class="feedback error">${escape(error.message)}</div></div>`;
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
  const stationery = area === 'papelaria';
  const sales=movements.filter(m=>m.kind==='sale');
  const revenue=sales.reduce((n,s)=>n+Number(s.amount_paid),0);
  const due=sales.reduce((n,s)=>n+Number(s.total_amount)-Number(s.amount_paid),0);
  const costKnown = sales.filter(s => s.total_cost !== null && s.total_cost !== undefined);
  const costSold = costKnown.reduce((n,s) => n + Number(s.total_cost), 0);
  const grossProfit = costKnown.reduce((n,s) => n + Number(s.total_amount) - Number(s.total_cost), 0);
  const unknownCosts = movements.some(m => m.total_cost == null) || products.some(p => Number(p.stock)>0 && p.average_cost == null);
  const stockValue = products.reduce((n,p) => n + Number(p.stock_value || 0), 0);
  const moneyOrUnknown = value => value == null ? 'Não informado' : formatMoney(value);
  const options=products.map(p=>`<option value="${p.id}">${escape(p.name)} (stock: ${p.stock})</option>`).join('');
  const names=new Map(products.map(p=>[p.id,p.name]));
  dom.pageContent.innerHTML=`<div class="grid gap-14">
    <div class="dashboard-grid"><div class="card stat"><h4>Receita recebida</h4><strong>${formatMoney(revenue)}</strong></div><div class="card stat"><h4>Por receber</h4><strong>${formatMoney(due)}</strong></div><div class="card stat"><h4>Lucro bruto das vendas</h4><strong>${formatMoney(grossProfit)}</strong></div><div class="card stat"><h4>Stock ao custo</h4><strong>${formatMoney(stockValue)}</strong></div></div>
    <details><summary>Como são calculados os valores?</summary><p>Custo dos produtos vendidos: ${formatMoney(costSold)}. Lucro bruto = vendas − custo dos produtos vendidos, incluindo vendas a crédito. Perdas e outras despesas não estão deduzidas. A receita recebida mostra apenas o que já foi pago.</p></details>
    ${unknownCosts ? '<div class="feedback error">Existem registos antigos sem custo. Os totais de custo, lucro e valorização são parciais; esses registos não são tratados como custo zero.</div>' : ''}
    <div id="retail-feedback" role="status"></div>
    <div class="toolbar" role="group" aria-label="O que deseja fazer?">
      <button type="button" class="btn btn-secondary" data-retail-tab="sale">Vender</button>
      <button type="button" class="btn btn-secondary" data-retail-tab="entry">${stationery ? 'Registar compra' : 'Adicionar stock'}</button>
      <button type="button" class="btn btn-secondary" data-retail-tab="products">Produtos e stock</button>
      <button type="button" class="btn btn-secondary" data-retail-tab="payments">Receber dívida</button>
      <button type="button" class="btn btn-secondary" data-retail-tab="history">Histórico e perdas</button>
    </div>
    <div id="retail-products-panel" class="split" hidden><div class="card"><h3>Novo produto</h3><form id="retail-product" class="form-grid">${input(stationery ? 'Nome do artigo' : 'Produto / marca / sabor','name','text','maxlength="120"')}${input('Preço de venda (MZN)','unit_price','number','min="0" step="0.01"')}<button class="btn btn-primary">Guardar produto</button></form></div>
    <div class="card"><h3>Stock actual</h3><div class="table-wrap"><table><thead><tr><th>Produto</th><th>Stock</th><th>Preço</th><th>Custo médio unitário</th><th>Valor ao custo</th></tr></thead><tbody>${products.map(p=>`<tr><td>${escape(p.name)}</td><td>${p.stock}</td><td>${formatMoney(p.unit_price)}</td><td>${moneyOrUnknown(p.average_cost)}</td><td>${moneyOrUnknown(p.stock_value)}</td></tr>`).join('')||'<tr><td colspan="5">Registe o primeiro produto.</td></tr>'}</tbody></table></div></div></div>
    <div class="card" id="retail-movement-panel"><h3 id="retail-movement-title">Vender</h3><form id="retail-movement" class="form-grid"><div class="field"><label>Produto<select name="product_id" required><option value="">Seleccionar produto</option>${options}</select></label></div><div class="field" hidden><label>Tipo<select name="kind"><option value="entry">Entrada / produção</option><option value="sale">Venda</option><option value="loss">Perda / quebra</option></select></label></div>${input('Data','date','date',`value="${today()}"`)}${input('Quantidade','quantity','number','min="1" step="1"')}<div id="retail-cost-fields" class="field full">
      ${input(stationery ? 'Quanto pagou por esta compra? (MZN)' : 'Custo total desta produção ou compra (MZN)','entry_cost','number','min="0" step="0.01"')}
      <p>${stationery ? 'Indique o valor total pago pelos artigos desta entrada. O custo por artigo é calculado automaticamente.' : 'Indique quanto gastou para obter esta quantidade de produtos prontos.'}</p>
      ${stationery ? '' : `<details id="retail-cost-calculator"><summary>Preciso de ajuda para calcular o custo</summary><div class="form-grid">${input('Ingredientes ou compra dos produtos (MZN)','materials_cost','number','min="0" step="0.01" value="0"')}${input('Saquinhos / embalagens (MZN)','packaging_cost','number','min="0" step="0.01" value="0"')}${input('Energia e água (MZN)','energy_cost','number','min="0" step="0.01" value="0"')}${input('Mão de obra (MZN)','labor_cost','number','min="0" step="0.01" value="0"')}${input('Outros gastos (MZN)','other_cost','number','min="0" step="0.01" value="0"')}</div></details>`}
      <output id="retail-cost-preview"></output></div><div id="retail-sale-fields" class="field full" hidden><div class="form-grid"><div class="field"><label>Método de pagamento<select name="payment_method" required><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="bank_transfer">Transferência</option><option value="credit">A crédito — pagar depois</option></select></label></div><div class="field full"><output id="retail-sale-preview" aria-live="polite">Seleccione o produto e a quantidade.</output></div><div id="retail-credit-fields" class="field full" hidden>${input('Nome do cliente para a dívida','credit_customer')}</div><details id="retail-sale-options" class="field full"><summary>Cliente ou pagamento parcial</summary><div class="form-grid"><div class="field"><label>Cliente (opcional)<input name="customer"></label></div><div class="field"><label><input type="checkbox" name="partial_payment"> Receber apenas parte do valor</label></div><div id="retail-partial-fields" class="field" hidden><label>Valor recebido (MZN)<input type="number" name="paid" min="0.01" step="0.01"></label></div></div></details></div></div><details class="field full"><summary>Adicionar observações</summary><textarea name="notes" aria-label="Observações"></textarea></details><button id="retail-movement-submit" class="btn btn-primary" ${products.length?'':'disabled'}>Guardar movimento</button></form></div>
    ${products.some(p=>p.average_cost==null && Number(p.stock)>0) ? `<div class="card" id="retail-valuation-panel" hidden><h3>Indicar custo do stock antigo</h3><p>Indique o custo unitário real do stock existente para permitir novos movimentos. Os custos de vendas anteriores continuam desconhecidos.</p><form id="retail-valuation" class="form-grid"><div class="field"><label>Produto<select name="product_id" required>${products.filter(p=>p.average_cost==null && Number(p.stock)>0).map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select></label></div>${input('Custo unitário do stock existente (MZN)','unit_cost','number','min="0" step="0.000001"')}<button class="btn btn-primary">Valorizar stock</button></form></div>` : ''}
    <div class="card" id="retail-payments-panel" hidden><h3>Receber dívida</h3><form id="retail-payment" class="form-grid"><div class="field"><label>Venda<select name="sale_id" required><option value="">Seleccionar dívida</option>${sales.filter(s=>Number(s.amount_paid)<Number(s.total_amount)).map(s=>`<option value="${s.id}">${escape(s.customer_name)} — ${escape(names.get(s.product_id))} — ${s.movement_date} — ${formatMoney(Number(s.total_amount)-Number(s.amount_paid))}</option>`).join('')}</select></label></div>${input('Data','date','date',`value="${today()}"`)}${input('Valor recebido (MZN)','amount','number','min="0.01" step="0.01"')}<button class="btn btn-primary">Registar pagamento</button></form></div>
    <div class="card" id="retail-history-panel" hidden><h3>Histórico</h3><button type="button" class="btn btn-secondary" id="retail-record-loss">Registar perda / quebra</button><h4>Movimentos recentes</h4><div class="table-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Cliente</th><th>Total</th><th>Recebido</th><th>Método</th><th>Por receber</th><th>Custo do movimento</th><th>Lucro bruto</th><th>Observações</th></tr></thead><tbody>${movements.slice(0,50).map(m=>`<tr><td>${escape(m.movement_date)}</td><td>${escape(names.get(m.product_id))}</td><td>${{entry:'Entrada',sale:'Venda',loss:'Perda'}[m.kind]}</td><td>${m.quantity}</td><td>${escape(m.customer_name||'-')}</td><td>${formatMoney(m.total_amount)}</td><td>${formatMoney(m.amount_paid)}</td><td>${escape(({cash:'Dinheiro',mpesa:'M-Pesa',emola:'e-Mola',bank_transfer:'Transferência',credit:'A crédito'})[m.payment_method] || '-')}</td><td>${formatMoney(Number(m.total_amount)-Number(m.amount_paid))}</td><td>${moneyOrUnknown(m.total_cost)}</td><td>${m.kind==='sale' && m.total_cost!=null ? formatMoney(Number(m.total_amount)-Number(m.total_cost)) : '-'}</td><td>${escape(m.notes||'-')}</td></tr>`).join('')||'<tr><td colspan="12">Sem movimentos.</td></tr>'}</tbody></table></div></div></div>`;
  const form=document.querySelector('#retail-movement');
  const costFields=stationery ? [] : ['materials_cost','packaging_cost','energy_cost','labor_cost','other_cost'];
  const calculator=document.querySelector('#retail-cost-calculator');
  const updateCost=()=>{
    if(calculator?.open) form.elements.entry_cost.value=costFields.reduce((n,name)=>n+Number(form.elements[name].value||0),0).toFixed(2);
    const total=Number(form.elements.entry_cost.value||0);
    const quantity=Number(form.elements.quantity.value||0);
    document.querySelector('#retail-cost-preview').textContent=`Custo por unidade: ${quantity>0?formatMoney(total/quantity):'indique a quantidade'}`;
  };
  const updateSale=()=>{
    const product=products.find(p=>p.id===form.elements.product_id.value);
    const quantity=Number(form.elements.quantity.value||0);
    const total=Math.round(Number(product?.unit_price||0)*quantity*100)/100;
    const sale=form.elements.kind.value==='sale';
    const credit=form.elements.payment_method.value==='credit';
    const partial=form.elements.partial_payment.checked && !credit;
    form.elements.payment_method.disabled=!sale;
    form.elements.credit_customer.disabled=!sale || !credit;
    document.querySelector('#retail-credit-fields').hidden=!credit;
    document.querySelector('#retail-sale-options').hidden=credit;
    form.elements.customer.disabled=!sale || credit;
    form.elements.partial_payment.disabled=!sale || credit;
    form.elements.customer.required=sale && partial;
    form.elements.paid.disabled=!sale || !partial;
    form.elements.paid.required=sale && partial;
    form.elements.paid.max=String(total);
    document.querySelector('#retail-partial-fields').hidden=!partial;
    document.querySelector('#retail-sale-preview').textContent=product && quantity>0
      ? `Preço: ${formatMoney(product.unit_price)} · Custo por unidade: ${moneyOrUnknown(product.average_cost)} · Total a ${credit?'receber':'pagar'}: ${formatMoney(total)}`
      : 'Seleccione o produto e a quantidade.';
  };
  form.addEventListener('input',()=>{updateCost();updateSale();});
  form.addEventListener('change',updateSale);
  calculator?.addEventListener('toggle',()=>{refreshFields();});
  const refreshFields=()=>{
    const sale=form.elements.kind.value==='sale';
    const entry=form.elements.kind.value==='entry';
    document.querySelector('#retail-cost-fields').hidden=!entry;
    form.elements.entry_cost.disabled=!entry;
    form.elements.entry_cost.readOnly=Boolean(calculator?.open);
    costFields.forEach(name=>{form.elements[name].disabled=!entry || !calculator?.open;});
    updateCost();
    document.querySelector('#retail-sale-fields').hidden=!sale;
    form.elements.date.closest('.field').hidden=sale;
    updateSale();
  };
  const panels=['products','payments','history'];
  const openTab=tab=>{
    panels.forEach(name=>{document.querySelector(`#retail-${name}-panel`).hidden=tab!==name;});
    const movement=['sale','entry','loss'].includes(tab);
    document.querySelector('#retail-movement-panel').hidden=!movement;
    const valuation=document.querySelector('#retail-valuation-panel');
    if(valuation) valuation.hidden=tab!=='products' && tab!=='entry';
    if(movement) {
      form.elements.kind.value=tab;
      const title=tab==='sale'?'Registar venda':tab==='loss'?'Registar perda / quebra':stationery?'Registar compra':'Adicionar produção ou compra';
      document.querySelector('#retail-movement-title').textContent=title;
      document.querySelector('#retail-movement-submit').textContent=tab==='sale'?'Guardar venda':tab==='loss'?'Guardar perda':'Guardar entrada';
      refreshFields();
    }
    document.querySelectorAll('[data-retail-tab]').forEach(button=>{
      const active=button.dataset.retailTab===tab || (tab==='loss' && button.dataset.retailTab==='history');
      button.classList.toggle('btn-primary',active);button.classList.toggle('btn-secondary',!active);
      button.setAttribute('aria-pressed',String(active));
    });
  };
  document.querySelectorAll('[data-retail-tab]').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.retailTab)));
  document.querySelector('#retail-record-loss').addEventListener('click',()=>openTab('loss'));
  form.elements.kind.addEventListener('change',refreshFields);
  form.elements.product_id.addEventListener('change',refreshFields);
  openTab(initialTab || (products.length ? 'sale' : 'products'));
  bind('#retail-product',async fd=>supabase.from('retail_products').insert({area,name:String(fd.get('name')).trim(),unit_price:Number(fd.get('unit_price'))}),area);
  bind('#retail-movement',async fd=>{
    if(fd.get('kind')==='sale') return supabase.rpc('register_retail_sale',{
      p_product:fd.get('product_id'),p_quantity:Number(fd.get('quantity')),p_payment_method:fd.get('payment_method'),
      p_customer:fd.get('payment_method')==='credit'?fd.get('credit_customer'):fd.get('customer')||null,
      p_paid:fd.get('partial_payment')?Number(fd.get('paid')):null,p_date:today(),p_notes:fd.get('notes')||null,
    });
    return supabase.rpc('register_retail_movement',{
      p_product:fd.get('product_id'),p_date:fd.get('date'),p_kind:fd.get('kind'),p_quantity:Number(fd.get('quantity')),
      p_entry_cost:fd.get('kind')==='entry'?Number(fd.get('entry_cost')):null,
      p_price:0,p_paid:0,p_customer:null,p_notes:[fd.get('notes'),fd.get('kind')==='entry' && calculator?.open?`Custos do lote (MZN): compra/ingredientes ${fd.get('materials_cost')}; embalagens ${fd.get('packaging_cost')}; energia/água ${fd.get('energy_cost')}; mão de obra ${fd.get('labor_cost')}; outros ${fd.get('other_cost')}.`:null].filter(Boolean).join('\n')||null,
    });
  },area);
  if(document.querySelector('#retail-valuation')) bind('#retail-valuation',async fd=>supabase.rpc('value_retail_stock',{p_product:fd.get('product_id'),p_unit_cost:Number(fd.get('unit_cost'))}),area);
  bind('#retail-payment',async fd=>supabase.rpc('register_retail_payment',{p_sale:fd.get('sale_id'),p_date:fd.get('date'),p_amount:Number(fd.get('amount'))}),area);
}
function bind(selector,save,area) {
  document.querySelector(selector).addEventListener('submit',async event=>{
    event.preventDefault(); const button=event.currentTarget.querySelector('button');
    if(button.disabled) return;
    button.disabled=true;
    try { const {error}=await save(new FormData(event.currentTarget)); if(error) throw error; const tab=document.querySelector('[data-retail-tab][aria-pressed="true"]')?.dataset.retailTab; await renderRetail(area,tab); showFeedback(document.querySelector('#retail-feedback'),'Registo guardado.','success'); }
    catch(error) {showFeedback(document.querySelector('#retail-feedback'),error.message,'error');}
    finally {button.disabled=false;}
  });
}
