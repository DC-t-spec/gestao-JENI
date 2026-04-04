import { supabase } from '../core/supabase-client.js';
import { formatMoney, formatNumber } from '../core/utils.js';
import { setPageHeader } from '../ui/ui.js';
import { dom } from '../ui/dom.js';
import { navTo } from '../router.js';

export async function renderDashboard() {
  setPageHeader('Dashboard', 'Resumo financeiro e operacional');

  const { data, error } = await supabase
    .from('dashboard_summary')
    .select('*')
    .single();

  const { data: stockData } = await supabase
    .from('batch_stock_summary')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) {
    dom.pageContent.innerHTML = `
      <div class="card">
        <h3>Erro ao carregar dashboard</h3>
        <p class="muted">${error.message}</p>
      </div>
    `;
    return;
  }

  dom.pageContent.innerHTML = `
    <div class="grid gap-14">
      <div class="quick-grid">
        <div class="quick-card" data-quick="compras">
          <strong>Registar compra</strong>
          <span>Lançar despesas, fornecedor e valores.</span>
        </div>
        <div class="quick-card" data-quick="entradas">
          <strong>Registar entrada de pintos</strong>
          <span>Controlar a entrada de aves por lote.</span>
        </div>
        <div class="quick-card" data-quick="vendas">
          <strong>Registar venda</strong>
          <span>Guardar cliente, quantidade, IVA e pagamento.</span>
        </div>
        <div class="quick-card" data-quick="mortalidade">
          <strong>Registar morte</strong>
          <span>Atualizar o sistema sempre que houver perda.</span>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card stat">
          <h4>Saldo do mês</h4>
          <div class="muted">Vendas do mês - compras do mês</div>
          <strong>${formatMoney(data.month_balance)}</strong>
        </div>

        <div class="card stat">
          <h4>Saldo total</h4>
          <div class="muted">Resultado acumulado</div>
          <strong>${formatMoney(data.total_balance)}</strong>
        </div>

        <div class="card stat">
          <h4>Recebido no mês</h4>
          <div class="muted">Valor efetivamente recebido</div>
          <strong>${formatMoney(data.month_received)}</strong>
        </div>

        <div class="card stat">
          <h4>Por receber no mês</h4>
          <div class="muted">Dívidas geradas este mês</div>
          <strong>${formatMoney(data.month_due)}</strong>
        </div>

        <div class="card stat">
          <h4>Total recebido</h4>
          <div class="muted">Dinheiro já recebido</div>
          <strong>${formatMoney(data.total_received)}</strong>
        </div>

        <div class="card stat">
          <h4>Total por receber</h4>
          <div class="muted">Dívidas pendentes/parciais</div>
          <strong>${formatMoney(data.total_due)}</strong>
        </div>

        <div class="card stat">
          <h4>Caixa real do mês</h4>
          <div class="muted">Recebido no mês - compras do mês</div>
          <strong>${formatMoney(data.real_month_cash_balance)}</strong>
        </div>

        <div class="card stat">
          <h4>Caixa real total</h4>
          <div class="muted">Recebido total - compras totais</div>
          <strong>${formatMoney(data.real_cash_balance)}</strong>
        </div>

        <div class="card stat">
          <h4>Vendas pendentes</h4>
          <div class="muted">Pendentes ou parciais</div>
          <strong>${formatNumber(data.total_pending_sales)}</strong>
        </div>

        <div class="card stat">
          <h4>Aves vivas</h4>
          <div class="muted">Disponível atualmente</div>
          <strong>${formatNumber(data.total_birds_alive)}</strong>
        </div>

        <div class="card stat">
          <h4>Mortes acumuladas</h4>
          <div class="muted">Perdas registadas</div>
          <strong>${formatNumber(data.total_birds_dead)}</strong>
        </div>

        <div class="card stat">
          <h4>Vendas do mês</h4>
          <div class="muted">Total vendido no mês</div>
          <strong>${formatMoney(data.month_sales)}</strong>
        </div>
      </div>

      <div class="cards-2">
        <div class="card">
          <div class="section-title">
            <div>
              <h3>Stock por lote</h3>
              <div class="muted">Entradas, mortes, vendas e disponível</div>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Início</th>
                  <th>Entradas</th>
                  <th>Mortes</th>
                  <th>Vendas</th>
                  <th>Disponível</th>
                </tr>
              </thead>
              <tbody>
                ${(stockData || []).map((row) => `
                  <tr>
                    <td>${row.name}</td>
                    <td>${row.start_date || ''}</td>
                    <td>${formatNumber(row.birds_in)}</td>
                    <td>${formatNumber(row.birds_dead)}</td>
                    <td>${formatNumber(row.birds_sold)}</td>
                    <td><strong>${formatNumber(row.birds_available)}</strong></td>
                  </tr>
                `).join('') || '<tr><td colspan="6">Sem dados.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h3>Leitura financeira</h3>
          <ul>
            <li><strong>Saldo</strong> considera tudo o que foi vendido, mesmo que ainda não tenha sido pago.</li>
            <li><strong>Caixa real</strong> considera apenas o que já entrou em dinheiro.</li>
            <li><strong>Total por receber</strong> mostra o valor ainda em dívida pelos clientes.</li>
            <li><strong>Vendas pendentes</strong> ajuda a controlar clientes que ainda não pagaram totalmente.</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-quick]').forEach((card) => {
    card.addEventListener('click', () => navTo(card.dataset.quick));
  });
}
