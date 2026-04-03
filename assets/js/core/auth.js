import { supabase } from './supabase-client.js';
import { state } from './state.js';

const authView = document.querySelector('#auth-view');
const appView = document.querySelector('#app-view');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const showLoginBtn = document.querySelector('#show-login-btn');
const showRegisterBtn = document.querySelector('#show-register-btn');
const authFeedback = document.querySelector('#auth-feedback');
const userInfo = document.querySelector('#user-info');

function showAuthFeedback(message, type = 'error') {
  if (!authFeedback) return;
  authFeedback.innerHTML = `<div class="feedback ${type}">${message}</div>`;
}

function clearAuthFeedback() {
  if (!authFeedback) return;
  authFeedback.innerHTML = '';
}

async function loadUserProfile(user) {
  if (!user) {
    state.currentUser = null;
    state.profile = null;
    return null;
  }

  state.currentUser = user;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Erro ao carregar perfil:', error);
    state.profile = null;
    return null;
  }

  state.profile = data;

  if (userInfo) {
    userInfo.textContent = `${data.email} · ${data.role}`;
  }

  console.log('AUTH currentUser:', state.currentUser);
  console.log('AUTH profile:', state.profile);

  return data;
}

export async function handleLogin(event) {
  event.preventDefault();
  clearAuthFeedback();

  const formData = new FormData(loginForm);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    showAuthFeedback('Preencha o email e a senha.', 'error');
    return;
  }

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showAuthFeedback(error.message, 'error');
      return;
    }

    await loadUserProfile(data.user);

    if (authView) authView.hidden = true;
    if (appView) appView.hidden = false;

    window.location.hash = '#/dashboard';
    showAuthFeedback('Login efetuado com sucesso.', 'success');
  } catch (err) {
    console.error('Erro no login:', err);
    showAuthFeedback('Erro inesperado ao entrar.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

export async function handleRegister(event) {
  event.preventDefault();
  clearAuthFeedback();

  const formData = new FormData(registerForm);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    showAuthFeedback('Preencha o email e a senha.', 'error');
    return;
  }

  const submitBtn = registerForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      showAuthFeedback(error.message, 'error');
      return;
    }

    showAuthFeedback('Conta criada com sucesso. Agora pode entrar.', 'success');

    registerForm.reset();
    registerForm.hidden = true;
    loginForm.hidden = false;
  } catch (err) {
    console.error('Erro no registo:', err);
    showAuthFeedback('Erro inesperado ao criar conta.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

export async function initAuth() {
  if (showLoginBtn && loginForm && registerForm) {
    showLoginBtn.addEventListener('click', () => {
      clearAuthFeedback();
      loginForm.hidden = false;
      registerForm.hidden = true;
    });
  }

  if (showRegisterBtn && loginForm && registerForm) {
    showRegisterBtn.addEventListener('click', () => {
      clearAuthFeedback();
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

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Erro ao verificar sessão:', error);
    return;
  }

  if (data.session?.user) {
    await loadUserProfile(data.session.user);

    if (authView) authView.hidden = true;
    if (appView) appView.hidden = false;
  } else {
    state.currentUser = null;
    state.profile = null;

    if (authView) authView.hidden = false;
    if (appView) appView.hidden = true;
  }
}
