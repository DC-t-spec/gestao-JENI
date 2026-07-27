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

document.querySelector('#jeni-brand')?.addEventListener('dblclick', () => {
  if (canAccessAdmin()) window.location.hash = '#/gestao-geral';
});
