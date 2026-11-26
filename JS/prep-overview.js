(() => {
  const container = document.getElementById('prep-overview-content');
  if (!container) return;
  const course = window.location.pathname.endsWith('dashboard-ser.html') ? 'ser' : 'informatica';
  const key = `ifpb-exam-preparation-v2-${course}`;

  function todayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function parseDate(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }

  function formatDate(value) {
    return parseDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }

  function create(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function render() {
    let plans = [];
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      plans = saved && Array.isArray(saved.plans) ? saved.plans : [];
      if (!plans.length) {
        const legacy = JSON.parse(localStorage.getItem(`ifpb-exam-preparation-v1-${course}`));
        if (legacy && legacy.examDate && Array.isArray(legacy.sessions)) plans = [legacy];
      }
    } catch (error) {
      plans = [];
    }

    const today = todayString();
    const upcoming = plans.filter(plan => plan && plan.examDate && Array.isArray(plan.sessions) && plan.examDate >= today)
      .sort((a, b) => a.examDate.localeCompare(b.examDate));
    container.innerHTML = '';

    if (!upcoming.length) {
      const empty = create('div', 'prep-overview-empty');
      const copy = create('p', '', 'Você ainda não tem uma prova planejada. Crie um cronograma para organizar os conteúdos e acompanhar seu progresso.');
      const link = create('a', 'prep-overview-link', 'Criar meu primeiro planejamento →');
      link.href = `preparacao.html?curso=${course}`;
      empty.append(copy, link);
      container.appendChild(empty);
      return;
    }

    const plan = upcoming[0];
    const completed = plan.sessions.filter(session => session.done).length;
    const total = plan.sessions.length;
    const progress = total ? Math.round(completed / total * 100) : 0;
    const daysLeft = Math.max(0, Math.ceil((parseDate(plan.examDate) - parseDate(today)) / 86400000));
    const nextSession = plan.sessions.filter(session => !session.done && session.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

    const main = create('div', 'prep-overview-main');
    const identity = create('div', 'prep-overview-identity');
    identity.append(create('strong', '', plan.subject), create('span', '', `Prova em ${formatDate(plan.examDate)} · ${daysLeft === 0 ? 'é hoje' : `${daysLeft} dia(s) restante(s)`}`));
    const stats = create('div', 'prep-overview-stats');
    stats.append(create('div', '', `${progress}% concluído`), create('div', '', `${completed}/${total} sessões`));
    const track = create('div', 'prep-overview-track');
    const fill = create('span');
    fill.style.width = `${progress}%`;
    track.appendChild(fill);
    main.append(identity, stats, track);
    if (nextSession) {
      const next = create('p', 'prep-overview-next');
      next.append(create('strong', '', 'Próxima atividade: '), document.createTextNode(`${nextSession.title} · ${formatDate(nextSession.date)} · ${nextSession.minutes} min`));
      main.appendChild(next);
    } else {
      main.appendChild(create('p', 'prep-overview-next', 'Todas as atividades deste planejamento foram concluídas. Boa prova!'));
    }
    container.appendChild(main);
  }

  render();
  window.addEventListener('storage', event => {
    if (event.key === key) render();
  });
})();
