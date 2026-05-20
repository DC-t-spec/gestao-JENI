import { supabase } from '../core/supabase-client.js';
import { formatMoney, formatNumber, getCurrentUserId } from '../core/utils.js';
import { setPageHeader } from '../ui/ui.js';
import { dom } from '../ui/dom.js';
import { navTo } from '../router.js';
import {
  createManualDeposit,
  createAccountTransfer,
  getFinancialAccountBalances,
  getActiveFinancialAccounts,
  getReceivablesSummary,
} from '../services/financial.service.js';

function getBalanceByName(accounts, keyword) {
  const normalizedKeyword = String(keyword || '').toLowerCase();
  const account = (accounts || []).find((item) =>
    String(item.name || '').toLowerCase().includes(normalizedKeyword)
  );

  return Number(account?.current_balance || 0);
}

function openFinancialModal({ title, fields, submitLabel, onSubmit }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `
    <div class="modal card" style="max-width:560px;margin:40px auto;">
      <h3>${title}</h3>
      <form class="form-grid" id="financial-action-form">
        ${fields}
        <div id="financial-modal-feedback" class="field full"></div>
        <div class="field full" style="display:flex;gap:10px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button>
          <button type="submit" class="btn btn-primary">${submitLabel}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('[data-close-modal]').addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const form = overlay.querySelector('#financial-action-form');
  const feedback = overlay.querySelector('#financial-modal-feedback');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.innerHTML = '';

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const formData = new FormData(form);
      await onSubmit(formData);
      close();
    } catch (error) {
      feedback.innerHTML = `<div class="alert alert-error">${error.message || 'Erro ao guardar operação financeira.'}</div>`;
    } finally {
      submitButton.disabled = false;
    }
  });
}

export async function renderDashboard() {
  setPageHeader('Dashboard', 'Resumo financeiro e operacional');

  const { data, error } = await supabase
    .from('dashboard_summary')
    .select('*')
    .single();

  const [{ data: stockData }, financialBalances, receivables, activeAccounts] = await Promise.all([
    supabase
      .from('batch_stock_summary')
      .select('*')
      .order('start_date', { ascending: false }),
    getFinancialAccountBalances().catch(() => []),
    getReceivablesSummary().catch(() => null),
    getActiveFinancialAccounts().catch(() => []),
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

  const accountOptions = (activeAccounts || []).map((account) => `<option value="${account.id}">${account.name}</option>`).join('');

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
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary" id="btn-manual-deposit">Depositar valor</button>
            <button class="btn btn-primary" id="btn-transfer">Transferir entre contas</button>
          </div>
        </div>

        <div class="dashboard-grid">
          <div class="card stat"><h4>Caixa físico</h4><strong>${formatMoney(getBalanceByName(financialBalances, 'caixa'))}</strong></div>
          <div class="card stat"><h4>M-Pesa JENI</h4><strong>${formatMoney(getBalanceByName(financialBalances, 'mpesa'))}</strong></div>
          <div class="card stat"><h4>e-Mola JENI</h4><strong>${formatMoney(getBalanceByName(financialBalances, 'emola'))}</strong></div>
          <div class="card stat"><h4>Conta bancária</h4><strong>${formatMoney(getBalanceByName(financialBalances, 'banco'))}</strong></div>
          <div class="card stat"><h4>Cartão / POS</h4><strong>${formatMoney(getBalanceByName(financialBalances, 'cartao'))}</strong></div>
          <div class="card stat"><h4>Total disponível</h4><strong>${formatMoney((financialBalances || []).reduce((sum, account) => sum + Number(account.current_balance || 0), 0))}</strong></div>
        </div>
      </div>

      <div class="card">
        <div class="section-title"><div><h3>Resumo do mês</h3><div class="muted">Indicadores executivos mensais</div></div></div>
        <div class="dashboard-grid">
          <div class="card stat"><h4>Vendas do mês</h4><strong>${formatMoney(data.month_sales)}</strong></div>
          <div class="card stat"><h4>Compras do mês</h4><strong>${formatMoney(data.month_purchases)}</strong></div>
          <div class="card stat"><h4>Caixa real do mês</h4><strong>${formatMoney(data.real_month_cash_balance)}</strong></div>
          <div class="card stat"><h4>Saldo do mês</h4><strong>${formatMoney(data.month_balance)}</strong></div>
        </div>
      </div>

      <div class="card">
        <div class="section-title"><div><h3>Contas a Receber</h3><div class="muted">Resumo de recebimentos pendentes</div></div></div>
        <div class="dashboard-grid">
          <div class="card stat"><h4>Total por receber</h4><strong>${formatMoney(receivables?.total_due || 0)}</strong></div>
          <div class="card stat"><h4>Vendas pendentes</h4><strong>${formatNumber(data.total_pending_sales || 0)}</strong></div>
        </div>
      </div>

      <div class="card">
        <div class="section-title"><div><h3>Operacional</h3><div class="muted">Estado produtivo actual</div></div></div>
        <div class="dashboard-grid">
          <div class="card stat"><h4>Aves vivas</h4><strong>${formatNumber(data.total_birds_alive)}</strong></div>
          <div class="card stat"><h4>Mortes acumuladas</h4><strong>${formatNumber(data.total_birds_dead)}</strong></div>
        </div>
      </div>

      <div class="card">
        <h3>Stock por lote</h3>
        <div class="table-wrap"><table><thead><tr><th>Lote</th><th>Início</th><th>Entradas</th><th>Mortes</th><th>Vendas</th><th>Disponível</th></tr></thead>
        <tbody>${(stockData || []).map((row) => `<tr><td>${row.name}</td><td>${row.start_date || ''}</td><td>${formatNumber(row.birds_in)}</td><td>${formatNumber(row.birds_dead)}</td><td>${formatNumber(row.birds_sold)}</td><td><strong>${formatNumber(row.birds_available)}</strong></td></tr>`).join('') || '<tr><td colspan="6">Sem dados.</td></tr>'}</tbody></table></div>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-quick]').forEach((card) => {
    card.addEventListener('click', () => navTo(card.dataset.quick));
  });

  document.querySelector('#btn-manual-deposit')?.addEventListener('click', () => {
    openFinancialModal({
      title: 'Depositar valor',
      submitLabel: 'Guardar depósito',
      fields: `
        <div class="field"><label>Conta destino</label><select name="account_id" required><option value="">Selecionar conta</option>${accountOptions}</select></div>
        <div class="field"><label>Valor</label><input type="number" name="amount" min="0.01" step="0.01" required /></div>
        <div class="field"><label>Data</label><input type="date" name="transaction_date" required /></div>
        <div class="field full"><label>Descrição / notas</label><textarea name="description"></textarea></div>
      `,
      onSubmit: async (fd) => {
        await createManualDeposit({
          account_id: fd.get('account_id'),
          amount: Number(fd.get('amount')),
          transaction_date: fd.get('transaction_date'),
          description: fd.get('description'),
          created_by: getCurrentUserId(),
        });
        await renderDashboard();
      },
    });
  });

  document.querySelector('#btn-transfer')?.addEventListener('click', () => {
    openFinancialModal({
      title: 'Transferir entre contas',
      submitLabel: 'Guardar transferência',
      fields: `
        <div class="field"><label>Conta origem</label><select name="from_account_id" required><option value="">Selecionar conta</option>${accountOptions}</select></div>
        <div class="field"><label>Conta destino</label><select name="to_account_id" required><option value="">Selecionar conta</option>${accountOptions}</select></div>
        <div class="field"><label>Valor</label><input type="number" name="amount" min="0.01" step="0.01" required /></div>
        <div class="field"><label>Data</label><input type="date" name="transaction_date" required /></div>
        <div class="field full"><label>Descrição / notas</label><textarea name="description"></textarea></div>
      `,
      onSubmit: async (fd) => {
        await createAccountTransfer({
          from_account_id: fd.get('from_account_id'),
          to_account_id: fd.get('to_account_id'),
          amount: Number(fd.get('amount')),
          transaction_date: fd.get('transaction_date'),
          description: fd.get('description'),
          created_by: getCurrentUserId(),
        });
        await renderDashboard();
      },
    });
  });
}
