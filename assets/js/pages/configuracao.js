import { supabase } from '../core/supabase-client.js';
import { state } from '../core/state.js';
import { canAccessAdmin, formatMoney, getCurrentUserId } from '../core/utils.js';
import { setPageHeader, showFeedback } from '../ui/ui.js';
import { dom } from '../ui/dom.js';
import { fetchBatches } from '../core/data.js';

export async function renderSettings() {
  setPageHeader('Configuração', 'Gestão de lotes, utilizadores e auditoria');

  if (!canAccessAdmin()) {
    dom.pageContent.innerHTML = `
      <div class="card">
        <h3>Acesso restrito</h3>
        <p class="muted">Esta área é apenas para administradores.</p>
      </div>`;
    return;
  }

  // 🔥 Buscar dados incluindo lotes
  const [
    { data: profiles, error: profilesError },
    { data: audit, error: auditError },
    batches,
    { data: chickenSales, error: chickenSalesError },
    { data: chickenPayments, error: chickenPaymentsError },
    { data: chickenFinancialMovements, error: chickenFinancialMovementsError },
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(25),
    fetchBatches(),
    supabase.from('sales').select('id, total_amount'),
    supabase.from('sale_payments').select('id'),
    supabase.from('financial_transactions').select('id, reference_type').in('reference_type', ['sale', 'sale_payment']),
  ]);

  if (profilesError) console.error('profilesError:', profilesError);
  if (auditError) console.error('auditError:', auditError);
  if (chickenSalesError) console.error('chickenSalesError:', chickenSalesError);
  if (chickenPaymentsError) console.error('chickenPaymentsError:', chickenPaymentsError);
  if (chickenFinancialMovementsError) console.error('chickenFinancialMovementsError:', chickenFinancialMovementsError);

  const chickenSalesCount = (chickenSales || []).length;
  const chickenSalesAmount = (chickenSales || []).reduce((total, sale) => total + Number(sale.total_amount || 0), 0);
  const chickenPaymentsCount = (chickenPayments || []).length;
  const chickenFinancialMovementsCount = (chickenFinancialMovements || []).length;
  const hasChickenSaleRecords = chickenSalesCount + chickenPaymentsCount + chickenFinancialMovementsCount > 0;

  console.log('audit:', audit);
  console.log('batches:', batches);

  dom.pageContent.innerHTML = `
    <div class="grid gap-14">
      <div class="split">
        <!-- NOVO LOTE -->
        <div class="card">
          <h3>Novo lote</h3>
          <form id="batch-form" class="form-grid">
            <div class="field">
              <label>Nome do lote</label>
              <input type="text" name="name" required placeholder="Ex: Lote Abril 2026" />
            </div>

            <div class="field">
              <label>Data de início</label>
              <input type="date" name="start_date" required />
            </div>

            <div class="field full">
              <label>Observações</label>
              <textarea name="notes"></textarea>
            </div>

            <div class="field full">
              <button class="btn btn-primary" type="submit">Criar lote</button>
            </div>
          </form>

          <div id="batch-feedback"></div>
        </div>

        <!-- UTILIZADORES -->
        <div class="card">
          <h3>Utilizadores</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Perfil</th>
                  <th>Ativo</th>
                </tr>
              </thead>
              <tbody>
                ${
                  (profiles || []).length
                    ? profiles.map((user) => `
                      <tr>
                        <td>${user.full_name || '-'}</td>
                        <td>${user.email || '-'}</td>
                        <td>${user.role || '-'}</td>
                        <td>${user.is_active ? 'Sim' : 'Não'}</td>
                      </tr>
                    `).join('')
                    : `<tr><td colspan="4">Sem utilizadores.</td></tr>`
                }
              </tbody>
            </table>
          </div>

          <div class="feedback warning mt-16">
            Para promover um utilizador a <strong>admin</strong>, faça update na tabela <strong>profiles</strong> no Supabase.
          </div>
        </div>
      </div>

      <!-- LOTES -->
      <div class="card">
        <h3>Lotes existentes</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Início</th>
                <th>Ativo</th>
              </tr>
            </thead>
            <tbody>
              ${
                (state.batches && state.batches.length)
                  ? state.batches.map((batch) => `
                    <tr>
                      <td>${batch.name}</td>
                      <td>${batch.start_date || '-'}</td>
                      <td>${batch.is_active ? 'Sim' : 'Não'}</td>
                    </tr>
                  `).join('')
                  : `<tr><td colspan="3">Sem lotes.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- LIMPEZA DAS VENDAS DE FRANGOS -->
      <div class="card">
        <h3>Limpar vendas de frangos</h3>
        <p class="muted">Remove exclusivamente as vendas de frangos, os respectivos pagamentos e os movimentos financeiros associados. Não altera ovos, poedeiras, entradas de frangos ou compras.</p>
        <div class="toolbar">
          <span class="badge">Vendas registadas: <strong style="margin-left:6px;">${chickenSalesCount}</strong></span>
          <span class="badge">Pagamentos: <strong style="margin-left:6px;">${chickenPaymentsCount}</strong></span>
          <span class="badge">Movimentos financeiros: <strong style="margin-left:6px;">${chickenFinancialMovementsCount}</strong></span>
          <span class="badge">Valor registado: <strong style="margin-left:6px;">${formatMoney(chickenSalesAmount)}</strong></span>
        </div>
        <button id="clear-chicken-sales" type="button" class="btn btn-secondary" ${hasChickenSaleRecords ? '' : 'disabled'}>Eliminar tudo das vendas de frangos</button>
        <div id="clear-chicken-sales-feedback"></div>
      </div>

      <!-- AUDITORIA -->
      <div class="card">
        <h3>Auditoria recente</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Tabela</th>
                <th>Registo</th>
              </tr>
            </thead>
            <tbody>
              ${
                (audit && audit.length)
                  ? audit.map((log) => `
                    <tr>
                      <td>${log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                      <td>${log.action_type || '-'}</td>
                      <td>${log.table_name || '-'}</td>
                      <td>${log.record_id || log.user_id || '-'}</td>
                    </tr>
                  `).join('')
                  : `<tr><td colspan="4">Sem auditoria disponível.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // 🔥 SUBMIT FORM LOTE
  document.querySelector('#batch-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const fd = new FormData(event.currentTarget);

    const payload = {
      name: String(fd.get('name')).trim(),
      start_date: fd.get('start_date'),
      notes: String(fd.get('notes') || '').trim() || null,
      created_by: getCurrentUserId(),
      is_active: true,
    };

    const { error } = await supabase.from('batches').insert(payload);

    const feedback = document.querySelector('#batch-feedback');

    if (error) {
      return showFeedback(feedback, error.message, 'error');
    }

    showFeedback(feedback, 'Lote criado com sucesso.', 'success');

    // 🔥 atualizar lista corretamente
    await fetchBatches();

    // limpar form
    event.currentTarget.reset();

    // re-render
    await renderSettings();
  });

  document.querySelector('#clear-chicken-sales')?.addEventListener('click', async () => {
    const feedback = document.querySelector('#clear-chicken-sales-feedback');
    const confirmation = window.prompt(
      `Vai eliminar ${chickenSalesCount} venda(s) de frangos, os respectivos pagamentos e movimentos financeiros. Esta operação não pode ser desfeita.\n\nPara confirmar, escreva: ELIMINAR FRANGOS`
    );

    if (confirmation !== 'ELIMINAR FRANGOS') {
      return showFeedback(feedback, 'Operação cancelada. Nenhum registo foi eliminado.', 'warning');
    }

    try {
      const removed = await clearChickenSales();
      showFeedback(feedback, `Limpeza concluída e verificada: ${removed.sales} venda(s), ${removed.payments} pagamento(s) e ${removed.transactions} movimento(s) financeiro(s) eliminados.`, 'success');
      await renderSettings();
    } catch (cleanupError) {
      console.error('Erro ao eliminar vendas de frangos:', cleanupError);
      showFeedback(feedback, cleanupError.message, 'error');
    }
  });
}

async function clearChickenSales() {
  const [salesResult, paymentsResult, transactionsResult] = await Promise.all([
    supabase.from('sales').select('id'),
    supabase.from('sale_payments').select('id'),
    supabase.from('financial_transactions').select('id').in('reference_type', ['sale', 'sale_payment']),
  ]);

  if (salesResult.error) throw salesResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  const saleIds = (salesResult.data || []).map((sale) => sale.id).filter(Boolean);
  const paymentIds = (paymentsResult.data || []).map((payment) => payment.id).filter(Boolean);
  const transactionIds = (transactionsResult.data || []).map((transaction) => transaction.id).filter(Boolean);

  if (transactionIds.length) {
    const { error: transactionsError } = await supabase
      .from('financial_transactions')
      .delete()
      .in('id', transactionIds);
    if (transactionsError) throw transactionsError;
  }

  if (paymentIds.length) {
    const { error: paymentsError } = await supabase
      .from('sale_payments')
      .delete()
      .in('id', paymentIds);
    if (paymentsError) throw paymentsError;
  }

  if (saleIds.length) {
    const { error: salesError } = await supabase
      .from('sales')
      .delete()
      .in('id', saleIds);
    if (salesError) throw salesError;
  }

  const [remainingSales, remainingPayments, remainingTransactions] = await Promise.all([
    supabase.from('sales').select('id'),
    supabase.from('sale_payments').select('id'),
    supabase.from('financial_transactions').select('id').in('reference_type', ['sale', 'sale_payment']),
  ]);

  if (remainingSales.error) throw remainingSales.error;
  if (remainingPayments.error) throw remainingPayments.error;
  if (remainingTransactions.error) throw remainingTransactions.error;

  const remainingCount = (remainingSales.data || []).length + (remainingPayments.data || []).length + (remainingTransactions.data || []).length;
  if (remainingCount > 0) {
    throw new Error(`A limpeza não ficou completa. Ainda existem ${(remainingSales.data || []).length} venda(s), ${(remainingPayments.data || []).length} pagamento(s) e ${(remainingTransactions.data || []).length} movimento(s) financeiro(s).`);
  }

  return { sales: saleIds.length, payments: paymentIds.length, transactions: transactionIds.length };
}
