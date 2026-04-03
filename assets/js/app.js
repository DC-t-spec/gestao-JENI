import { initAuth } from './auth.js';
import { registerRoute, startRouter } from './router.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderComprasPage } from './pages/compras.js';
import { renderVendasPage } from './pages/vendas.js';
import { renderMortalidadePage } from './pages/mortalidade.js';
import { renderRelatoriosPage } from './pages/relatorios.js';
import { renderConfiguracaoPage } from './pages/configuracao.js';
import { supabase } from './supabase-client.js';

registerRoute('/dashboard', renderDashboardPage);
registerRoute('/compras', renderComprasPage);
registerRoute('/vendas', renderVendasPage);
registerRoute('/mortalidade', renderMortalidadePage);
registerRoute('/relatorios', renderRelatoriosPage);
registerRoute('/configuracao', renderConfiguracaoPage);

const logoutBtn = document.querySelector('#logout-btn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Erro ao terminar sessão:', error.message);
      return;
    }

    window.location.hash = '#/dashboard';
    window.location.reload();
  });
}

await initAuth();
startRouter();
