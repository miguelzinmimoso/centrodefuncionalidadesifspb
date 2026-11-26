// Aplica o tema salvo (ou o do sistema) antes da página aparecer, evitando "piscar" de claro para escuro.
(() => {
  let saved = null;
  try { saved = window.localStorage.getItem('ifpb-theme-v1'); } catch (error) { /* sem armazenamento */ }
  // Padrão claro; o tema só muda por escolha do aluno no cadastro ou no painel.
  const dark = saved === 'dark';
  const canToggle = true;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  window.ifpbTheme = {
    canToggle,
    toggle() {
      if (!canToggle) return;
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { window.localStorage.setItem('ifpb-theme-v1', next); } catch (error) { /* ignora */ }
      document.querySelectorAll('.theme-toggle').forEach((b) => { b.textContent = next === 'dark' ? '☀️' : '🌙'; });
    }
  };
  // Botão de alternância colocado no cabeçalho de cada página.
  if (canToggle) document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Alternar entre modo claro e escuro');
    btn.title = 'Alternar tema';
    btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', () => window.ifpbTheme.toggle());
    const nav = document.querySelector('.nav-links');
    if (nav) { const li = document.createElement('li'); li.className = 'profile-nav-item'; li.append(btn); nav.append(li); return; }
    const header = document.querySelector('.institutional-header, .header');
    if (header) header.append(btn); else btn.classList.add('floating'), document.body.append(btn);
  });
})();
