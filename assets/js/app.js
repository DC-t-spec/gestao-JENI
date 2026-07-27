import { initAuth } from './core/auth.js';
import { startRouter } from './router.js';
import { supabase } from './core/supabase-client.js';
import { canAccessAdmin } from './core/utils.js';

document.querySelector('#logout-btn')?.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) return console.error('Erro ao terminar sessão:', error.message);
  window.location.hash = '#/dashboard';
  window.location.reload();
});

await initAuth();
await startRouter();

const brand = document.querySelector('#jeni-brand');

function openGeneralManagement() {
  if (!canAccessAdmin()) {
    window.alert('A Gestão Geral da JENI está disponível apenas para perfis com a função admin.');
    return;
  }
  window.location.hash = '#/gestao-geral';
}

brand?.addEventListener('dblclick', openGeneralManagement);
brand?.addEventListener('click', (event) => {
  if (event.detail >= 2) openGeneralManagement();
});
