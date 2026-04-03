import { supabase } from './core/supabase-client.js';
import { state } from './core/state.js';
import { handleLogin, handleRegister, initSession, logout } from './core/auth.js';
import { fetchBatches, fetchProfile } from './core/data.js';
import { updateUserUI } from './ui/ui.js';
import { navTo, renderRoute } from './router.js';
import { dom } from './ui/dom.js';

const showLoginBtn = document.querySelector('#show-login-btn');
const showRegisterBtn = document.querySelector('#show-register-btn');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const logoutBtn = document.querySelector('#logout-btn');

if (showLoginBtn && loginForm && registerForm) {
  showLoginBtn.addEventListener('click', () => {
    loginForm.hidden = false;
    registerForm.hidden = true;
  });
}

if (showRegisterBtn && loginForm && registerForm) {
  showRegisterBtn.addEventListener('click', () => {
    loginForm.hidden = true;
    registerForm.hidden = false;
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

if (registerForm) {
  registerForm.addEventListener('submit', handleRegister);
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', logout);
}

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
