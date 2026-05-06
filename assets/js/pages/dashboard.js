import { supabase } from '../core/supabase-client.js';
import { formatMoney, formatNumber } from '../core/utils.js';
import { setPageHeader } from '../ui/ui.js';
import { dom } from '../ui/dom.js';
import { navTo } from '../router.js';
import {
  getFinancialAccountBalances,
  getReceivablesSummary,
} from '../services/financial.service.js';

function getBalanceByName(accounts, keyword) {
  const normalizedKeyword = String(keyword || '').toLowerCase();
  const account = (accounts || []).find((item) =>
    String(item.name || '').toLowerCase().includes(normalizedKeyword)
  );

  return Number(account?.current_balance || 0);
}

export async function renderDashboard() {
  setPageHeader('Dashboard', 'Resumo financeiro e operacional');

  const { data, error } = await supabase
    .from('dashboard_summary')
    .select('*')
    .single();

  const [{ data: stockData }, financialBalances, receivables] = await Promise.all([
    supabase
      .from('batch_stock_summary')
      .select('*')
      .order('start_date', { ascending: false }),
    getFinancialAccountBalances().catch(() => []),
    getReceivablesSummary().catch(() => null),
  ]);

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


      <div class="card">
        <div class="section-title">
          <div>
            <h3>Financeiro Real</h3>
            <div class="muted">Saldos por conta financeira</div>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="card stat">
            <h4>Caixa físico</h4>
            <strong>${formatMoney(getBalanceByName(financialBalances, 'caixa'))}</strong>
          </div>
          <div class="card stat">
            <h4>M-Pesa JENI</h4>
            <strong>${formatMoney(getBalanceByName(financialBalances, 'mpesa'))}</strong>
          </div>
          <div class="card stat">
            <h4>e-Mola JENI</h4>
            <strong>${formatMoney(getBalanceByName(financialBalances, 'emola'))}</strong>
          </div>
          <div class="card stat">
            <h4>Conta bancária</h4>
            <strong>${formatMoney(getBalanceByName(financialBalances, 'banco'))}</strong>
          </div>
          <div class="card stat">
            <h4>Cartão / POS</h4>
            <strong>${formatMoney(getBalanceByName(financialBalances, 'cartao'))}</strong>
          </div>
          <div class="card stat">
            <h4>Total disponível</h4>
            <strong>${formatMoney((financialBalances || []).reduce((sum, account) => sum + Number(account.current_balance || 0), 0))}</strong>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">
          <div>
            <h3>Contas a Receber</h3>
            <div class="muted">Resumo de dívidas e vencimentos</div>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="card stat"><h4>Total em dívida</h4><strong>${formatMoney(receivables?.total_due || 0)}</strong></div>
          <div class="card stat"><h4>A receber hoje</h4><strong>${formatMoney(receivables?.due_today || 0)}</strong></div>
          <div class="card stat"><h4>A receber esta semana</h4><strong>${formatMoney(receivables?.due_this_week || 0)}</strong></div>
          <div class="card stat"><h4>A receber este mês</h4><strong>${formatMoney(receivables?.due_this_month || 0)}</strong></div>
          <div class="card stat"><h4>Valor em atraso</h4><strong>${formatMoney(receivables?.overdue_amount || 0)}</strong></div>
          <div class="card stat"><h4>Vendas em atraso</h4><strong>${formatNumber(receivables?.overdue_sales_count || 0)}</strong></div>
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
