import { supabase } from '../core/supabase-client.js';
import { formatMoney, formatNumber } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';

export async function renderReports() {
  setPageHeader('Relatórios', 'Consulta financeira por período personalizado');

  dom.pageContent.innerHTML = `
    <div class="grid gap-14">
      <div class="card">
        <h3>Gerar relatório financeiro</h3>
        <form id="report-form" class="form-grid">
          <div class="field"><label>Data inicial</label><input type="date" name="start_date" required /></div>
          <div class="field"><label>Data final</label><input type="date" name="end_date" required /></div>
          <div class="field full"><button class="btn btn-primary" type="submit">Gerar relatório</button></div>
        </form>
        <div id="report-feedback"></div>
      </div>
      <div id="report-results"></div>
    </div>`;

  document.querySelector('#report-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const startDate = form.start_date.value;
    const endDate = form.end_date.value;
    const feedback = document.querySelector('#report-feedback');
    const results = document.querySelector('#report-results');

    if (startDate > endDate) {
      return showFeedback(feedback, 'A data inicial não pode ser maior que a data final.', 'warning');
    }

    const [{ data: sales, error: salesError }, { data: purchases, error: purchasesError }, { data: mortality, error: mortalityError }] = await Promise.all([
      supabase.from('sales_financial_report').select('*').gte('sale_date', startDate).lte('sale_date', endDate).order('sale_date', { ascending: false }),
      supabase.from('purchases').select('*').gte('purchase_date', startDate).lte('purchase_date', endDate).order('purchase_date', { ascending: false }),
      supabase.from('mortality_logs').select('*').gte('log_date', startDate).lte('log_date', endDate).order('log_date', { ascending: false }),
    ]);

    if (salesError || purchasesError || mortalityError) {
      return showFeedback(feedback, salesError?.message || purchasesError?.message || mortalityError?.message, 'error');
    }

    const totalBase = (sales || []).reduce((sum, row) => sum + Number(row.taxable_base || 0), 0);
    const totalVat = (sales || []).reduce((sum, row) => sum + Number(row.vat_amount || 0), 0);
    const totalSales = (sales || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const totalPurchases = (purchases || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const totalDeaths = (mortality || []).reduce((sum, row) => sum + Number(row.quantity_dead || 0), 0);
    const balance = totalSales - totalPurchases;

    showFeedback(feedback, 'Relatório gerado com sucesso.', 'success');

    results.innerHTML = `
      <div class="dashboard-grid">
        <div class="card stat"><h4>Base tributável</h4><strong>${formatMoney(totalBase)}</strong></div>
        <div class="card stat"><h4>Total IVA</h4><strong>${formatMoney(totalVat)}</strong></div>
        <div class="card stat"><h4>Total vendas</h4><strong>${formatMoney(totalSales)}</strong></div>
        <div class="card stat"><h4>Total compras</h4><strong>${formatMoney(totalPurchases)}</strong></div>
        <div class="card stat"><h4>Saldo do período</h4><strong>${formatMoney(balance)}</strong></div>
        <div class="card stat"><h4>Mortalidade no período</h4><strong>${formatNumber(totalDeaths)}</strong></div>
      </div>

      <div class="card mt-16">
        <h3>Vendas do período</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Cliente</th><th>Qtd</th><th>Base</th><th>Taxa IVA</th><th>IVA</th><th>Total</th></tr></thead>
            <tbody>
              ${(sales || []).map((row) => `
                <tr><td>${row.sale_date || ''}</td><td>${row.customer_name || ''}</td><td>${row.quantity || ''}</td><td>${formatMoney(row.taxable_base || 0)}</td><td>${row.apply_vat ? Number(row.vat_rate || 0).toFixed(2) + '%' : 'Sem IVA'}</td><td>${formatMoney(row.vat_amount || 0)}</td><td><strong>${formatMoney(row.total_amount || 0)}</strong></td></tr>
              `).join('') || '<tr><td colspan="7">Sem vendas no período.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mt-16">
        <h3>Compras do período</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Item</th><th>Categoria</th><th>Qtd</th><th>Total</th></tr></thead>
            <tbody>
              ${(purchases || []).map((row) => `
                <tr><td>${row.purchase_date || ''}</td><td>${row.item_name || ''}</td><td>${row.category || ''}</td><td>${row.quantity || ''}</td><td>${formatMoney(row.total_amount || 0)}</td></tr>
              `).join('') || '<tr><td colspan="5">Sem compras no período.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  });
}
