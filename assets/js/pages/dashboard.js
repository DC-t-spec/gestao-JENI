import { supabase } from '../core/supabase-client.js';
import { formatMoney, formatNumber } from '../core/utils.js';
import { setPageHeader } from '../ui/ui.js';
import { dom } from '../ui/dom.js';
import { navTo } from '../router.js';

export async function renderDashboard() {
  setPageHeader('Dashboard', 'Resumo financeiro e operacional');

  const { data, error } = await supabase.from('dashboard_summary').select('*').single();
  const { data: stockData } = await supabase.from('batch_stock_summary').select('*').order('start_date', { ascending: false });

  if (error) {
    dom.pageContent.innerHTML = `<div class="card"><h3>Erro ao carregar dashboard</h3><p class="muted">${error.message}</p></div>`;
    return;
  }

  dom.pageContent.innerHTML = `
    <div class="grid gap-14">
      <div class="quick-grid">
        <div class="quick-card" data-quick="compras"><strong>Registar compra</strong><span>Lançar despesas, fornecedor e valores.</span></div>
        <div class="quick-card" data-quick="entradas"><strong>Registar entrada de pintos</strong><span>Controlar a entrada de aves por lote.</span></div>
        <div class="quick-card" data-quick="vendas"><strong>Registar venda</strong><span>Guardar cliente, quantidade, IVA e total.</span></div>
        <div class="quick-card" data-quick="mortalidade"><strong>Registar morte</strong><span>Atualizar o sistema sempre que houver perda.</span></div>
      </div>

      <div class="dashboard-grid">
        <div class="card stat"><h4>Saldo do mês</h4><div class="muted">Vendas do mês - compras do mês</div><strong>${formatMoney(data.month_balance)}</strong></div>
        <div class="card stat"><h4>Saldo total</h4><div class="muted">Resultado acumulado</div><strong>${formatMoney(data.total_balance)}</strong></div>
        <div class="card stat"><h4>Vendas do mês</h4><div class="muted">Receita mensal</div><strong>${formatMoney(data.month_sales)}</strong></div>
        <div class="card stat"><h4>Compras do mês</h4><div class="muted">Despesa mensal</div><strong>${formatMoney(data.month_purchases)}</strong></div>
        <div class="card stat"><h4>Aves vivas</h4><div class="muted">Disponível atualmente</div><strong>${formatNumber(data.total_birds_alive)}</strong></div>
        <div class="card stat"><h4>Mortes acumuladas</h4><div class="muted">Perdas registadas</div><strong>${formatNumber(data.total_birds_dead)}</strong></div>
      </div>

      <div class="cards-2">
        <div class="card">
          <div class="section-title">
            <div><h3>Stock por lote</h3><div class="muted">Entradas, mortes, vendas e disponível</div></div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Lote</th><th>Início</th><th>Entradas</th><th>Mortes</th><th>Vendas</th><th>Disponível</th></tr></thead>
              <tbody>
                ${(stockData || []).map((row) => `
                  <tr>
                    <td>${row.name}</td><td>${row.start_date || ''}</td><td>${formatNumber(row.birds_in)}</td>
                    <td>${formatNumber(row.birds_dead)}</td><td>${formatNumber(row.birds_sold)}</td><td><strong>${formatNumber(row.birds_available)}</strong></td>
                  </tr>`).join('') || '<tr><td colspan="6">Sem dados.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h3>Notas rápidas</h3>
          <ul>
            <li>Use <strong>Entradas de pintos</strong> para registar a entrada inicial das aves.</li>
            <li>Use <strong>Mortalidade</strong> sempre que ocorrer uma morte.</li>
            <li>Nas <strong>Vendas</strong>, ative o IVA quando necessário.</li>
            <li>Os relatórios mostram <strong>base tributável</strong>, <strong>IVA</strong> e <strong>total final</strong>.</li>
          </ul>
        </div>
      </div>
    </div>`;

  document.querySelectorAll('[data-quick]').forEach((card) => {
    card.addEventListener('click', () => navTo(card.dataset.quick));
  });
}
