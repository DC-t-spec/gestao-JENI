import { state } from './core/state.js';
import { canAccessAdmin } from './core/utils.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderPurchases } from './pages/compras.js';
import { renderBirdEntries } from './pages/entradas.js';
import { renderSales } from './pages/vendas.js';
import { renderMortality } from './pages/mortalidade.js';
import { renderReports } from './pages/relatorios.js';
import { renderSettings } from './pages/configuracao.js';

const routes = {
  dashboard: renderDashboard,
  compras: renderPurchases,
  entradas: renderBirdEntries,
  vendas: renderSales,
  mortalidade: renderMortality,
  relatorios: renderReports,
  configuracao: renderSettings,
};

export function navTo(route) {
  state.route = route;
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === route);
  });
  renderRoute(route);
}

export async function renderRoute(route) {
  if (route === 'configuracao' && !canAccessAdmin()) {
    route = 'dashboard';
    state.route = route;
  }
  const renderer = routes[route] || routes.dashboard;
  await renderer();
}
