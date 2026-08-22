import { supabase } from '../core/supabase-client.js';
import { formatMoney, formatNumber } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';
import { validateFinancialAccountBalances } from '../services/financial.service.js';

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

    const [
      { data: sales, error: salesError },
      { data: eggSales, error: eggSalesError },
      { data: purchases, error: purchasesError },
      { data: mortality, error: mortalityError },
      { data: transactions, error: transactionsError },
      { data: allChickenSales, error: allChickenSalesError },
      { data: allEggSales, error: allEggSalesError },
      { data: salePayments, error: salePaymentsError },
    ] = await Promise.all([
      supabase.from('sales_financial_report').select('*').gte('sale_date', startDate).lte('sale_date', endDate).order('sale_date', { ascending: false }),
      supabase.from('egg_sales').select('*').gte('sale_date', startDate).lte('sale_date', endDate).order('sale_date', { ascending: false }),
      supabase.from('purchases').select('*').gte('purchase_date', startDate).lte('purchase_date', endDate).order('purchase_date', { ascending: false }),
      supabase.from('mortality_logs').select('*').gte('log_date', startDate).lte('log_date', endDate).order('log_date', { ascending: false }),
      supabase.from('financial_transactions').select('*').gte('transaction_date', startDate).lte('transaction_date', endDate).order('transaction_date', { ascending: false }),
      supabase.from('sales').select('id, total_amount, amount_paid, amount_due'),
      supabase.from('egg_sales').select('id, total_amount, payment_method'),
      supabase.from('sale_payments').select('id, sale_id, amount_paid'),
    ]);

    if (salesError || eggSalesError || purchasesError || mortalityError || transactionsError || allChickenSalesError || allEggSalesError) {
      return showFeedback(feedback, salesError?.message || eggSalesError?.message || purchasesError?.message || mortalityError?.message || transactionsError?.message || allChickenSalesError?.message || allEggSalesError?.message, 'error');
    }

    const validTransactions = validateFinancialAccountBalances([], transactions, {
      chickenSales: allChickenSales,
      eggSales: allEggSales,
      salePayments: salePaymentsError ? null : salePayments,
    }).transactions;
    const totalBase = (sales || []).reduce((sum, row) => sum + Number(row.taxable_base || 0), 0);
    const totalVat = (sales || []).reduce((sum, row) => sum + Number(row.vat_amount || 0), 0);
    const chickenSalesTotal = (sales || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const eggSalesTotal = (eggSales || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const totalSales = chickenSalesTotal + eggSalesTotal;
    const chickenAmountDue = (sales || []).reduce((sum, row) => sum + Number(row.amount_due || 0), 0);
    const eggAmountDue = (eggSales || []).filter((row) => !row.payment_method).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const totalPurchases = (purchases || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const totalDeaths = (mortality || []).reduce((sum, row) => sum + Number(row.quantity_dead || 0), 0);
    const balance = totalSales - totalPurchases;
    const cashIn = validTransactions
      .filter((row) => String(row.direction || '').toLowerCase() === 'in')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const cashOut = validTransactions
      .filter((row) => String(row.direction || '').toLowerCase() === 'out')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const realCash = cashIn - cashOut;

    showFeedback(feedback, 'Relatório gerado com sucesso.', 'success');

    results.innerHTML = `
      <div class="dashboard-grid">
        <div class="card stat"><h4>Base tributável</h4><strong>${formatMoney(totalBase)}</strong></div>
        <div class="card stat"><h4>Total IVA</h4><strong>${formatMoney(totalVat)}</strong></div>
        <div class="card stat"><h4>Total vendas</h4><strong>${formatMoney(totalSales)}</strong></div>
        <div class="card stat"><h4>Vendas de frangos</h4><strong>${formatMoney(chickenSalesTotal)}</strong></div>
        <div class="card stat"><h4>Vendas de ovos</h4><strong>${formatMoney(eggSalesTotal)}</strong></div>
        <div class="card stat"><h4>Frangos por receber</h4><strong>${formatMoney(chickenAmountDue)}</strong></div>
        <div class="card stat"><h4>Ovos por receber</h4><strong>${formatMoney(eggAmountDue)}</strong></div>
        <div class="card stat"><h4>Total compras</h4><strong>${formatMoney(totalPurchases)}</strong></div>
        <div class="card stat"><h4>Saldo do período</h4><strong>${formatMoney(balance)}</strong></div>
        <div class="card stat"><h4>Entradas de caixa real</h4><strong>${formatMoney(cashIn)}</strong></div>
        <div class="card stat"><h4>Saídas de caixa real</h4><strong>${formatMoney(cashOut)}</strong></div>
        <div class="card stat"><h4>Caixa real do período</h4><strong>${formatMoney(realCash)}</strong></div>
        <div class="card stat"><h4>Mortalidade no período</h4><strong>${formatNumber(totalDeaths)}</strong></div>
      </div>

      <div class="card mt-16">
        <h3>Vendas de frangos do período</h3>
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
        <h3>Vendas de ovos do período</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Cliente</th><th>Forma</th><th>Quantidade</th><th>Ovos</th><th>Pagamento</th><th>Total</th></tr></thead>
            <tbody>
              ${(eggSales || []).map((row) => `
                <tr><td>${row.sale_date || ''}</td><td>${row.customer_name || ''}</td><td>${row.sale_unit === 'tray' ? 'Bandeja' : 'Unidade'}</td><td>${row.quantity || 0}</td><td>${row.egg_quantity || 0}</td><td>${row.payment_method ? 'Pago' : 'Pendente'}</td><td><strong>${formatMoney(row.total_amount || 0)}</strong></td></tr>
              `).join('') || '<tr><td colspan="7">Sem vendas de ovos no período.</td></tr>'}
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
