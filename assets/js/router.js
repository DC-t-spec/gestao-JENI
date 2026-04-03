const routes = {};

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export async function startRouter() {
  async function renderRoute() {
    const hash = window.location.hash || '#/dashboard';
    const path = hash.replace('#', '');
    const handler = routes[path];

    if (!handler) {
      document.querySelector('#app').innerHTML = '<div class="card"><h2>Página não encontrada</h2></div>';
      return;
    }

    await handler();
  }

  window.addEventListener('hashchange', renderRoute);
  await renderRoute();
}
