import { state } from './core/state.js';
import { canAccessAdmin } from './core/utils.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderPurchases } from './pages/compras.js';
import { renderBirdEntries } from './pages/entradas.js';
import { renderSales } from './pages/vendas.js';
import { renderMortality } from './pages/mortalidade.js';
import { renderReports } from './pages/relatorios.js';
import { renderSettings } from './pages/configuracao.js';
import { renderEggs } from './pages/ovos.js';
import { renderGeneralManagement } from './pages/gestao-geral.js';

const routes = {
  dashboard: renderDashboard, compras: renderPurchases, entradas: renderBirdEntries,
  vendas: renderSales, mortalidade: renderMortality, ovos: renderEggs,
  relatorios: renderReports, configuracao: renderSettings, 'gestao-geral': renderGeneralManagement,
};

export function navTo(route) {
  state.route = route;
  window.location.hash = `#/${route}`;
  renderRoute(route);
}

export async function renderRoute(route) {
  if (['configuracao', 'gestao-geral'].includes(route) && !canAccessAdmin()) route = 'dashboard';
  await (routes[route] || routes.dashboard)();
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.route === route));
}

export async function startRouter() {
  const handleRoute = () => renderRoute((window.location.hash || '#/dashboard').replace('#/', '') || 'dashboard');
  window.addEventListener('hashchange', handleRoute);
  await handleRoute();
}
