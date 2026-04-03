import { initAuth } from './core/auth.js';
import { startRouter } from './router.js';
import { supabase } from './core/supabase-client.js';

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
await startRouter();
