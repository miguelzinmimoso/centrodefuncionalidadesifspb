(() => {
  const PROFILE_KEY = 'ifpb-student-profile-v1';
  const SESSION_KEY = 'ifpb-session-mode-v1';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Link para pular direto ao conteúdo principal (teclado e leitores de tela).
  const main = document.querySelector('main');
  if (main) {
    main.id = main.id || 'conteudo-principal';
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${main.id}`;
    skip.textContent = 'Pular para o conteúdo';
    document.body.prepend(skip);
  }

  // Botão de voltar ao topo, exibido após rolar a página.
  const topButton = document.createElement('button');
  topButton.type = 'button';
  topButton.className = 'back-to-top';
  topButton.setAttribute('aria-label', 'Voltar ao topo');
  topButton.textContent = '↑';
  topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  document.body.append(topButton);
  window.addEventListener('scroll', () => topButton.classList.toggle('is-shown', window.scrollY > 500), { passive: true });

  // Mostrar/ocultar senha em todos os campos de senha.
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.append(input);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'pw-toggle';
    toggle.textContent = 'Mostrar';
    toggle.setAttribute('aria-label', 'Mostrar senha');
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Ocultar' : 'Mostrar';
      toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    });
    wrap.append(toggle);
  });

  // Saudação conforme o horário, com o primeiro nome do aluno autenticado.
  const intro = document.querySelector('.daily-goals-wrap .eyebrow');
  if (intro) {
    let firstName = '';
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === 'authenticated') {
        const profile = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || '{}');
        firstName = String(profile.name || '').trim().split(/\s+/)[0] || '';
      }
    } catch (error) { /* sem perfil legível: mantém a saudação genérica */ }
    const hour = new Date().getHours();
    const salutation = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const date = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    const greeting = document.createElement('div');
    greeting.className = 'greeting';
    const strong = document.createElement('strong');
    strong.textContent = firstName ? `${salutation}, ${firstName}!` : `${salutation}!`;
    const span = document.createElement('span');
    span.textContent = date;
    greeting.append(strong, span);
    intro.before(greeting);
  }

  // Entrada suave de seções e cartões ao aparecerem na tela.
  const targets = document.querySelectorAll('.course-card, .feature, .mini-card, .planner-panel, .prep-overview-panel, .overview-panel, .grid-container .card, .form-section');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    targets.forEach((element) => { element.classList.add('reveal'); observer.observe(element); });
  }
})();
