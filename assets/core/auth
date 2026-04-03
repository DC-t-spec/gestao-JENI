import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { dom } from '../ui/dom.js';
import { showFeedback, updateUserUI } from '../ui/ui.js';
import { fetchProfile, fetchBatches } from './data.js';
import { renderRoute } from '../router.js';

export async function initSession() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

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
}

export async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')).trim(),
    password: String(formData.get('password')),
  });

  if (error) {
    showFeedback(dom.authFeedback, error.message, 'error');
    return;
  }

  form.reset();
  showFeedback(dom.authFeedback, 'Login efetuado com sucesso.', 'success');
  await initSession();
}

export async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const { error } = await supabase.auth.signUp({
    email: String(formData.get('email')).trim(),
    password: String(formData.get('password')),
    options: {
      data: {
        full_name: String(formData.get('full_name')).trim(),
      },
    },
  });

  if (error) {
    showFeedback(dom.authFeedback, error.message, 'error');
    return;
  }

  form.reset();
  showFeedback(dom.authFeedback, 'Conta criada. Verifique o email se a confirmação estiver ativa.', 'success');
}

export async function logout() {
  await supabase.auth.signOut();
  state.currentUser = null;
  state.profile = null;
  dom.authView.hidden = false;
  dom.appView.hidden = true;
  showFeedback(dom.authFeedback, 'Sessão terminada com sucesso.', 'success');
}
