import { supabase } from '../core/supabase-client.js';
import { formatMoney, formatNumber, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

const today = () => new Date().toISOString().slice(0, 10);

export async function renderEggs() {
  setPageHeader('Ovos e poedeiras', 'Produção diária, stock, poedeiras e vendas');
  const [{ data: summary, error }, { data: production }, { data: sales }] = await Promise.all([
    supabase.from('egg_business_summary').select('*').single(),
    supabase.from('egg_production').select('*').order('production_date', { ascending: false }).limit(15),
    supabase.from('egg_sales').select('*').order('sale_date', { ascending: false }).limit(15),
  ]);
  if (error) {
    dom.pageContent.innerHTML = `<div class="card"><h3>Configuração necessária</h3><p>Execute a actualização SQL no Supabase.</p><div class="feedback error">${error.message}</div></div>`;
    return;
  }
  dom.pageContent.innerHTML = `<div class="grid gap-14">
    <div class="dashboard-grid">
      <div class="card stat"><h4>Poedeiras vivas</h4><strong>${formatNumber(summary.layers_alive)}</strong></div>
      <div class="card stat"><h4>Ovos produzidos</h4><strong>${formatNumber(summary.eggs_produced)}</strong></div>
      <div class="card stat"><h4>Ovos vendidos</h4><strong>${formatNumber(summary.eggs_sold)}</strong></div>
      <div class="card stat"><h4>Stock de ovos</h4><strong>${formatNumber(summary.eggs_in_stock)}</strong></div>
      <div class="card stat"><h4>Receita de ovos</h4><strong>${formatMoney(summary.egg_revenue)}</strong></div>
    </div>
    <div class="split">
      <div class="card"><h3>Produção diária</h3><form id="egg-production-form" class="form-grid">
        <div class="field"><label>Data</label><input type="date" name="production_date" value="${today()}" required></div>
        <div class="field"><label>Quantidade de ovos</label><input type="number" name="egg_count" min="0" required></div>
        <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
        <button class="btn btn-primary">Guardar produção</button></form><div id="egg-production-feedback"></div></div>
      <div class="card"><h3>Movimento de poedeiras</h3><form id="layer-form" class="form-grid">
        <div class="field"><label>Tipo</label><select name="movement_type"><option value="entry">Entrada</option><option value="death">Mortalidade</option></select></div>
        <div class="field"><label>Data</label><input type="date" name="movement_date" value="${today()}" required></div>
        <div class="field"><label>Quantidade</label><input type="number" name="quantity" min="1" required></div>
        <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
        <button class="btn btn-primary">Guardar movimento</button></form><div id="layer-feedback"></div></div>
    </div>
    <div class="card"><h3>Venda de ovos</h3><form id="egg-sale-form" class="form-grid">
      <div class="field"><label>Data</label><input type="date" name="sale_date" value="${today()}" required></div>
      <div class="field"><label>Cliente</label><input name="customer_name" required></div>
      <div class="field"><label>Forma de venda</label><select name="sale_unit"><option value="unit">Unidade</option><option value="tray">Bandeja (30 ovos)</option></select></div>
      <div class="field"><label>Quantidade</label><input type="number" name="quantity" min="1" required></div>
      <div class="field"><label>Preço por unidade/bandeja</label><input type="number" name="unit_price" min="0" step="0.01" required></div>
      <div class="field"><label>Pagamento</label><select name="payment_method"><option value="cash">Dinheiro</option><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option><option value="bank_transfer">Transferência</option></select></div>
      <div class="field full"><label>Observações</label><textarea name="notes"></textarea></div>
      <button class="btn btn-primary">Guardar venda</button></form><div id="egg-sale-feedback"></div></div>
    <div class="split">
      <div class="card"><h3>Produção recente</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Ovos</th><th>Observações</th></tr></thead><tbody>
      ${(production || []).map(r => `<tr><td>${r.production_date}</td><td>${r.egg_count}</td><td>${r.notes || '-'}</td></tr>`).join('') || '<tr><td colspan="3">Sem registos.</td></tr>'}</tbody></table></div></div>
      <div class="card"><h3>Vendas recentes</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Venda</th><th>Ovos</th><th>Total</th></tr></thead><tbody>
      ${(sales || []).map(r => `<tr><td>${r.sale_date}</td><td>${r.customer_name}</td><td>${r.quantity} ${r.sale_unit === 'tray' ? 'bandeja(s)' : 'unidade(s)'}</td><td>${r.egg_quantity}</td><td>${formatMoney(r.total_amount)}</td></tr>`).join('') || '<tr><td colspan="5">Sem registos.</td></tr>'}</tbody></table></div></div>
    </div></div>`;

  bind('#egg-production-form', '#egg-production-feedback', 'egg_production', fd => ({
    production_date: fd.get('production_date'), egg_count: Number(fd.get('egg_count')), notes: fd.get('notes') || null, created_by: getCurrentUserId(),
  }), 'Produção registada.');
  bind('#layer-form', '#layer-feedback', null, fd => ({
    table: fd.get('movement_type') === 'death' ? 'layer_mortality' : 'layer_entries',
    payload: { movement_date: fd.get('movement_date'), quantity: Number(fd.get('quantity')), notes: fd.get('notes') || null, created_by: getCurrentUserId() },
  }), 'Movimento registado.');
  document.querySelector('#egg-sale-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const quantity = Number(fd.get('quantity'));
    const eggQuantity = fd.get('sale_unit') === 'tray' ? quantity * 30 : quantity;
    const feedback = document.querySelector('#egg-sale-feedback');
    if (eggQuantity > Number(summary.eggs_in_stock)) return showFeedback(feedback, 'Quantidade superior ao stock disponível.', 'error');
    const { error: saleError } = await supabase.from('egg_sales').insert({
      sale_date: fd.get('sale_date'), customer_name: fd.get('customer_name'), sale_unit: fd.get('sale_unit'),
      quantity, egg_quantity: eggQuantity, unit_price: Number(fd.get('unit_price')),
      total_amount: quantity * Number(fd.get('unit_price')), payment_method: fd.get('payment_method'),
      notes: fd.get('notes') || null, created_by: getCurrentUserId(),
    });
    if (saleError) return showFeedback(feedback, saleError.message, 'error');
    await renderEggs();
  });
}

function bind(formSelector, feedbackSelector, table, makeData, success) {
  document.querySelector(formSelector).addEventListener('submit', async e => {
    e.preventDefault(); const feedback = document.querySelector(feedbackSelector); const result = makeData(new FormData(e.currentTarget));
    const { error } = await supabase.from(result.table || table).insert(result.payload || result);
    if (error) return showFeedback(feedback, error.message, 'error');
    showFeedback(feedback, success, 'success'); await renderEggs();
  });
}
