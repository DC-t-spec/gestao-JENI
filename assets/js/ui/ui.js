import { dom } from './dom.js';
import { state } from '../core/state.js';
import { canAccessAdmin } from '../core/utils.js';

export function showFeedback(container, message, type = 'success') {
  container.innerHTML = `<div class="feedback ${type}">${message}</div>`;
}

export function setPageHeader(title, subtitle) {
  dom.pageTitle.textContent = title;
  dom.pageSubtitle.textContent = subtitle;
}

export function updateUserUI() {
  const fullName = state.profile?.full_name || state.currentUser?.email || 'Utilizador';
  const role = state.profile?.role || 'sem perfil';
  const activeBatches = state.batches.filter((batch) => batch.is_active).length;

  dom.topbarUser.textContent = `${fullName} · ${role}`;
  dom.topbarBatch.textContent = `Lotes ativos: ${activeBatches}`;
  dom.sidebarUserName.textContent = fullName;
  dom.sidebarUserRole.textContent = `Perfil: ${role}`;

  document.querySelectorAll('.admin-only').forEach((element) => {
    element.hidden = !canAccessAdmin();
  });
}
