import { supabase } from '../supabase-client.js';

export async function renderDashboardPage() {
  document.querySelector('#page-title').textContent = 'Dashboard';
  document.querySelector('#page-subtitle').textContent = 'Resumo atual do negócio';

  const app = document.querySelector('#app');

  const { data, error } = await supabase
    .from('dashboard_summary')
    .select('*')
    .single();

  if (error) {
    app.innerHTML = `<div class="card"><h2>Erro ao carregar dashboard</h2><p>${error.message}</p></div>`;
    return;
  }

  app.innerHTML = `
    <section class="dashboard-grid">
      <div class="card stat-card">
        <h3>Saldo do mês</h3>
        <strong>${Number(data.month_balance || 0).toFixed(2)} MZN</strong>
      </div>
      <div class="card stat-card">
        <h3>Saldo total</h3>
        <strong>${Number(data.total_balance || 0).toFixed(2)} MZN</strong>
      </div>
      <div class="card stat-card">
        <h3>Vendas do mês</h3>
        <strong>${Number(data.month_sales || 0).toFixed(2)} MZN</strong>
      </div>
      <div class="card stat-card">
        <h3>Compras do mês</h3>
        <strong>${Number(data.month_purchases || 0).toFixed(2)} MZN</strong>
      </div>
      <div class="card stat-card">
        <h3>Aves vivas</h3>
        <strong>${Number(data.total_birds_alive || 0).toFixed(0)}</strong>
      </div>
      <div class="card stat-card">
        <h3>Mortes acumuladas</h3>
        <strong>${Number(data.total_birds_dead || 0).toFixed(0)}</strong>
      </div>
    </section>
  `;
}
