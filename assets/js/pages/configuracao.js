export async function renderConfiguracaoPage() {
  document.querySelector('#page-title').textContent = 'Configuração';
  document.querySelector('#page-subtitle').textContent = 'Gestão de utilizadores e permissões';

  document.querySelector('#app').innerHTML = `
    <div class="card">
      <h2>Configuração</h2>
      <p>Aqui vamos colocar:</p>
      <ul>
        <li>criação de utilizadores</li>
        <li>níveis admin e caixa</li>
        <li>auditoria do sistema</li>
      </ul>
    </div>
  `;
}
