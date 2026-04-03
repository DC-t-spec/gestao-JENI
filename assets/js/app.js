import { registerRoute, startRouter } from './router.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderComprasPage } from './pages/compras.js';
import { renderVendasPage } from './pages/vendas.js';
import { renderMortalidadePage } from './pages/mortalidade.js';
import { renderRelatoriosPage } from './pages/relatorios.js';
import { renderConfiguracaoPage } from './pages/configuracao.js';

registerRoute('/dashboard', renderDashboardPage);
registerRoute('/compras', renderComprasPage);
registerRoute('/vendas', renderVendasPage);
registerRoute('/mortalidade', renderMortalidadePage);
registerRoute('/relatorios', renderRelatoriosPage);
registerRoute('/configuracao', renderConfiguracaoPage);

startRouter();
