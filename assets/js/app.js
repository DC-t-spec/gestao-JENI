import { supabase } from './core/supabase-client.js';
import { state } from './core/state.js';
import { handleLogin, handleRegister, initSession, logout } from './core/auth.js';
import { fetchBatches, fetchProfile } from './core/data.js';
import { updateUserUI } from './ui/ui.js';
import { navTo, renderRoute } from './router.js';
import { dom } from './ui/dom.js';

document.querySelector('#show-login-btn').addEventListener('click', () => {
  document.querySelector('#login-form').hidden = false;
  document.querySelector('#register-form').hidden = true;
});

document.querySelector('#show-register-btn').addEventListener('click', () => {
  document.querySelector('#login-form').hidden = true;
  document.querySelector('#register-form').hidden = false;
});

document.querySelector('#login-form').addEventListener('submit', handleLogin);
document.querySelector('#register-form').addEventListener('submit', handleRegister);
document.querySelector('#logout-btn').addEventListener('click', logout);

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => navTo(link.dataset.route));
});

supabase.auth.onAuthStateChange(async (_event, session) => {
  if (!session?.user) {
    dom.authView.hidden = false;
    dom.appView.hidden = true;
    return;
  }

  state.currentUser = session.user;
  state.profile = await fetchProfile(session.user.id);
  await fetchBatches();
  updateUserUI();
  dom.authView.hidden = true;
  dom.appView.hidden = false;
  await renderRoute(state.route);
});

initSession();
