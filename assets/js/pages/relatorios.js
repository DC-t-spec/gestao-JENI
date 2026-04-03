import { supabase } from '../supabase-client.js';
      <h2>Relatório financeiro</h2>
      <form id="report-form" class="form-grid">
        <input type="date" name="start_date" required />
        <input type="date" name="end_date" required />
        <button type="submit" class="btn btn-primary">Gerar relatório</button>
      </form>
      <div id="report-results"></div>
    </div>
  `;

  document.querySelector('#report-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const startDate = form.start_date.value;
    const endDate = form.end_date.value;

    const { data, error } = await supabase
      .from('sales_financial_report')
      .select('*')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: false });

    const results = document.querySelector('#report-results');

    if (error) {
      results.innerHTML = `<p class="feedback error">${error.message}</p>`;
      return;
    }

    const totalBase = data.reduce((sum, row) => sum + Number(row.taxable_base || 0), 0);
    const totalVat = data.reduce((sum, row) => sum + Number(row.vat_amount || 0), 0);
    const totalFinal = data.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

    results.innerHTML = `
      <div class="report-summary">
        <p><strong>Base tributável:</strong> ${totalBase.toFixed(2)} MZN</p>
        <p><strong>Total IVA:</strong> ${totalVat.toFixed(2)} MZN</p>
        <p><strong>Total final:</strong> ${totalFinal.toFixed(2)} MZN</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Qtd</th>
              <th>Base</th>
              <th>IVA</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                <td>${row.sale_date}</td>
                <td>${row.customer_name}</td>
                <td>${row.quantity}</td>
                <td>${Number(row.taxable_base).toFixed(2)}</td>
                <td>${Number(row.vat_amount).toFixed(2)}</td>
                <td>${Number(row.total_amount).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });
}
