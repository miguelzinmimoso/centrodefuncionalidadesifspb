(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const course = params.get('curso') === 'ser' ? 'ser' : 'informatica';
  const storageKey = `ifpb-exam-preparation-v2-${course}`;
  const legacyStorageKey = `ifpb-exam-preparation-v1-${course}`;
  const dashboardLink = document.getElementById('back-dashboard');
  dashboardLink.href = course === 'ser' ? 'dashboard-ser.html' : 'dashboard.html';

  const form = document.getElementById('prep-form');
  const subjectInput = document.getElementById('prep-subject');
  const dateInput = document.getElementById('prep-date');
  const hoursInput = document.getElementById('prep-hours');
  const topicsContainer = document.getElementById('prep-topics');
  const message = document.getElementById('prep-form-message');
  const results = document.getElementById('prep-results');
  const plansContainer = document.getElementById('prep-plans');
  const libraryContainer = document.getElementById('plan-library');
  const submitButton = document.getElementById('prep-submit');
  const cancelEditButton = document.getElementById('cancel-edit-button');

  let plans = [];
  let activePlanId = null;
  let editingPlanId = null;
  let currentPlan = null;
  let notice = null;

  function makeId(prefix = 'plan') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function formatDate(value, options = { weekday: 'long', day: '2-digit', month: 'long' }) {
    return parseLocalDate(value).toLocaleDateString('pt-BR', options);
  }

  function normalizePlan(plan) {
    if (!plan || typeof plan !== 'object' || !Array.isArray(plan.sessions) || !Array.isArray(plan.topics)) return null;
    const topics = plan.topics.map(topic => ({
      name: String(topic.name || '').trim().slice(0, 90),
      level: Math.min(3, Math.max(1, Number(topic.level) || 2)),
      knowledge: Math.min(2, Math.max(0, Number(topic.knowledge) || 0)),
    })).filter(topic => topic.name);
    const examDate = String(plan.examDate || '');
    if (!topics.length || !/^\d{4}-\d{2}-\d{2}$/.test(examDate) || !plan.subject) return null;
    return {
      id: plan.id || makeId(),
      subject: String(plan.subject).slice(0, 60),
      examDate,
      hours: Math.min(6, Math.max(0.5, Number(plan.hours) || 2)),
      topics,
      sessions: plan.sessions.map(session => ({
        id: session.id || makeId('session'),
        date: String(session.date || plan.examDate),
        title: String(session.title || 'Estudo'),
        detail: String(session.detail || ''),
        minutes: Math.max(5, Number(session.minutes) || 25),
        done: Boolean(session.done),
        kind: ['topic', 'review', 'practice'].includes(session.kind) ? session.kind : 'topic',
      })),
      createdAt: plan.createdAt || new Date().toISOString(),
      updatedAt: plan.updatedAt || plan.createdAt || new Date().toISOString(),
      collapsed: Boolean(plan.collapsed),
    };
  }

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Array.isArray(saved.plans)) {
        plans = saved.plans.map(normalizePlan).filter(Boolean);
        activePlanId = saved.activePlanId || (plans[0] && plans[0].id) || null;
        return;
      }
    } catch (error) { /* Tenta migrar os dados da versão anterior. */ }

    try {
      const legacy = JSON.parse(localStorage.getItem(legacyStorageKey));
      const migrated = normalizePlan(legacy);
      if (migrated) {
        plans = [migrated];
        activePlanId = migrated.id;
        saveData();
      }
    } catch (error) { /* Sem dados anteriores. */ }
  }

  function saveData() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 2, plans, activePlanId }));
      return true;
    } catch (error) {
      message.textContent = 'Não foi possível salvar. Baixe um backup ou libere espaço no navegador.';
      return false;
    }
  }

  function addTopicRow(name = '', level = '2', knowledge = '1') {
    const row = document.createElement('div');
    row.className = 'prep-topic-row';
    row.innerHTML = `
      <input class="prep-topic-name" type="text" maxlength="90" placeholder="Ex.: Genética" aria-label="Nome do conteúdo" required>
      <select class="prep-topic-level" aria-label="Dificuldade do conteúdo">
        <option value="1">Fácil</option><option value="2">Médio</option><option value="3">Difícil</option>
      </select>
      <select class="prep-topic-knowledge" aria-label="Quanto você conhece do conteúdo">
        <option value="0">Não estudei</option><option value="1">Sei um pouco</option><option value="2">Já domino</option>
      </select>
      <button class="prep-remove-topic" type="button" aria-label="Remover conteúdo">×</button>`;
    row.querySelector('.prep-topic-name').value = name;
    row.querySelector('.prep-topic-level').value = String(level);
    row.querySelector('.prep-topic-knowledge').value = String(knowledge);
    row.querySelector('.prep-remove-topic').addEventListener('click', () => {
      row.remove();
      updateRemoveButtons();
    });
    topicsContainer.appendChild(row);
    updateRemoveButtons();
  }

  function updateRemoveButtons() {
    const buttons = [...topicsContainer.querySelectorAll('.prep-remove-topic')];
    buttons.forEach(button => { button.disabled = buttons.length === 1; });
  }

  document.getElementById('add-topic').addEventListener('click', () => addTopicRow());

  function distributeTopicMinutes(topics, totalMinutes) {
    const minimum = 15;
    const weights = topics.map(topic => Math.max(1, topic.level * (3 - topic.knowledge)));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const enoughForMinimum = totalMinutes >= topics.length * minimum;
    const remaining = enoughForMinimum ? totalMinutes - topics.length * minimum : totalMinutes;
    const allocations = topics.map((topic, index) => {
      const base = enoughForMinimum ? minimum : 0;
      return { topic, minutes: base + (remaining * weights[index] / totalWeight) };
    });
    let roundedTotal = 0;
    allocations.forEach(item => {
      item.minutes = Math.floor(item.minutes / 5) * 5;
      roundedTotal += item.minutes;
    });
    let spare = Math.floor((totalMinutes - roundedTotal) / 5);
    let index = 0;
    while (spare > 0 && allocations.length) {
      allocations[index % allocations.length].minutes += 5;
      spare -= 1;
      index += 1;
    }
    return allocations;
  }

  function generateSchedule(plan) {
    const today = parseLocalDate(localDateString(new Date()));
    const examDate = parseLocalDate(plan.examDate);
    const daysUntilExam = Math.max(0, Math.round((examDate - today) / 86400000));
    const dailyMinutes = Math.round(Number(plan.hours) * 60);
    if (daysUntilExam === 0) {
      return [{ id: makeId('session'), date: localDateString(today), title: 'Revisão final', detail: 'Revise os pontos principais e organize o material da avaliação.', minutes: Math.min(dailyMinutes, 30), done: false, kind: 'review' }];
    }

    const allDates = Array.from({ length: daysUntilExam }, (_, index) => localDateString(addDays(today, index)));
    const reviewDate = allDates.length >= 2 ? allDates[allDates.length - 1] : null;
    const practiceDate = allDates.length >= 4 ? allDates[allDates.length - 2] : null;
    let contentDates = allDates.filter(date => date !== reviewDate && date !== practiceDate);
    if (!contentDates.length) contentDates = [allDates[0]];

    const sessions = [];
    const totalContentMinutes = contentDates.length * dailyMinutes;
    const allocations = distributeTopicMinutes(plan.topics, totalContentMinutes);
    const dailyLoad = new Map(contentDates.map(date => [date, 0]));

    allocations.forEach(({ topic, minutes }) => {
      let remaining = minutes;
      let part = 0;
      while (remaining >= 5) {
        const availableDate = contentDates
          .filter(date => dailyLoad.get(date) < dailyMinutes)
          .sort((a, b) => dailyLoad.get(a) - dailyLoad.get(b) || a.localeCompare(b))[0];
        if (!availableDate) break;
        const capacity = dailyMinutes - dailyLoad.get(availableDate);
        const chunk = Math.min(45, remaining, capacity);
        if (chunk < 5) break;
        sessions.push({
          id: makeId('session'),
          date: availableDate,
          title: topic.name,
          detail: part === 0 ? 'Estude o conteúdo, faça anotações e registre suas dúvidas.' : 'Retome o assunto e resolva exercícios para fixar o conteúdo.',
          minutes: chunk,
          done: false,
          kind: 'topic',
        });
        dailyLoad.set(availableDate, dailyLoad.get(availableDate) + chunk);
        remaining -= chunk;
        part += 1;
      }
    });

    if (practiceDate) {
      sessions.push({ id: makeId('session'), date: practiceDate, title: 'Prática e exercícios', detail: 'Resolva questões sem consultar o material e identifique suas dúvidas.', minutes: dailyMinutes, done: false, kind: 'practice' });
    }
    if (reviewDate) {
      sessions.push({ id: makeId('session'), date: reviewDate, title: 'Revisão geral', detail: 'Revise anotações, fórmulas e os pontos em que teve mais dificuldade.', minutes: dailyMinutes, done: false, kind: 'review' });
    }
    return sessions.sort((a, b) => a.date.localeCompare(b.date));
  }

  function collectFormTopics() {
    return [...topicsContainer.querySelectorAll('.prep-topic-row')].map(row => ({
      name: row.querySelector('.prep-topic-name').value.trim(),
      level: Number(row.querySelector('.prep-topic-level').value),
      knowledge: Number(row.querySelector('.prep-topic-knowledge').value),
    })).filter(topic => topic.name);
  }

  function createOrUpdatePlan(event) {
    event.preventDefault();
    const topics = collectFormTopics();
    if (!subjectInput.value.trim()) {
      message.textContent = 'Informe o nome da disciplina.';
      subjectInput.focus();
      return;
    }
    if (!topics.length) {
      message.textContent = 'Adicione pelo menos um conteúdo da prova.';
      return;
    }
    if (topics.length > 20) {
      message.textContent = 'Adicione no máximo 20 conteúdos por planejamento.';
      return;
    }
    const today = localDateString(new Date());
    if (!dateInput.value || dateInput.value < today) {
      message.textContent = 'Escolha uma data de hoje em diante.';
      dateInput.focus();
      return;
    }

    const existing = plans.find(plan => plan.id === editingPlanId);
    const plan = {
      id: existing ? existing.id : makeId(),
      subject: subjectInput.value.trim(),
      examDate: dateInput.value,
      hours: Number(hoursInput.value),
      topics,
      sessions: [],
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      collapsed: false,
    };
    const generated = generateSchedule(plan);
    if (existing) {
      const completed = new Set(existing.sessions.filter(session => session.done).map(session => `${session.date}|${session.title}|${session.kind}`));
      generated.forEach(session => { session.done = completed.has(`${session.date}|${session.title}|${session.kind}`); });
      plan.sessions = generated;
      plans = plans.map(item => item.id === plan.id ? plan : item);
    } else {
      plan.sessions = generated;
      plans.unshift(plan);
    }
    activePlanId = plan.id;
    editingPlanId = null;
    if (saveData()) {
      message.textContent = '';
      cancelEditButton.hidden = true;
      submitButton.innerHTML = 'Montar meu cronograma <span aria-hidden="true">→</span>';
      const wasEditing = Boolean(existing);
      resetForm();
      renderAll();
      message.textContent = wasEditing ? 'Planejamento atualizado.' : 'Planejamento criado! Você pode criar outro quando quiser.';
      const created = findCard(plan.id);
      if (created) created.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderLibrary() {
    libraryContainer.innerHTML = '';
    if (!plans.length) {
      const empty = document.createElement('p');
      empty.className = 'prep-library-empty';
      empty.textContent = 'Você ainda não criou um planejamento. Preencha os dados abaixo para começar.';
      libraryContainer.appendChild(empty);
      return;
    }
    plans.slice().sort((a, b) => a.examDate.localeCompare(b.examDate)).forEach(plan => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `prep-plan-card${plan.id === activePlanId ? ' is-active' : ''}`;
      const completed = plan.sessions.filter(session => session.done).length;
      const percent = plan.sessions.length ? Math.round(completed / plan.sessions.length * 100) : 0;
      const date = formatDate(plan.examDate, { day: '2-digit', month: 'short' });
      const title = document.createElement('strong');
      title.textContent = plan.subject;
      const meta = document.createElement('span');
      meta.textContent = `Prova: ${date} · ${percent}% concluído`;
      const progress = document.createElement('span');
      progress.className = 'prep-plan-mini-track';
      const fill = document.createElement('i');
      fill.style.width = `${percent}%`;
      progress.appendChild(fill);
      card.append(title, meta, progress);
      card.addEventListener('click', () => {
        activePlanId = plan.id;
        plan.collapsed = false;
        saveData();
        renderAll();
        const target = findCard(plan.id);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      libraryContainer.appendChild(card);
    });
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function findCard(id) {
    return [...plansContainer.querySelectorAll('[data-plan-id]')].find(card => card.dataset.planId === id) || null;
  }

  function planStats(plan) {
    const today = parseLocalDate(localDateString(new Date()));
    const daysLeft = Math.max(0, Math.ceil((parseLocalDate(plan.examDate) - today) / 86400000));
    const done = plan.sessions.filter(session => session.done).length;
    const total = plan.sessions.length;
    return { daysLeft, done, total, progress: total ? Math.round(done / total * 100) : 0 };
  }

  function stat(label, value, hint) {
    const box = el('article', 'prep-stat');
    box.append(el('span', '', label), el('strong', '', value), el('small', '', hint));
    return box;
  }

  function deletePlan(plan) {
    if (!window.confirm(`Deseja excluir o planejamento de ${plan.subject}? Essa ação não pode ser desfeita.`)) return;
    plans = plans.filter(item => item.id !== plan.id);
    if (activePlanId === plan.id) activePlanId = plans[0] ? plans[0].id : null;
    if (editingPlanId === plan.id) resetForm();
    saveData();
    renderAll();
  }

  // Monta o cartão de um planejamento: o cabeçalho minimiza/expande o conteúdo.
  function buildPlanCard(plan) {
    const { daysLeft, done, total, progress } = planStats(plan);
    const card = el('article', `prep-plan-block${plan.collapsed ? ' is-collapsed' : ''}${plan.id === activePlanId ? ' is-active' : ''}`);
    card.dataset.planId = plan.id;

    const toggle = el('button', 'prep-plan-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(!plan.collapsed));
    toggle.setAttribute('aria-controls', `plan-body-${plan.id}`);
    toggle.title = plan.collapsed ? 'Expandir planejamento' : 'Minimizar planejamento';
    const title = el('span', 'prep-plan-block-title');
    title.append(el('strong', '', `Preparação para ${plan.subject}`), el('small', '', `Prova em ${formatDate(plan.examDate, { day: '2-digit', month: 'long', year: 'numeric' })} · ${plan.hours}h de estudo por dia`));
    const badges = el('span', 'prep-plan-badges');
    badges.append(el('span', '', daysLeft === 1 ? '1 dia' : `${daysLeft} dias`), el('span', '', `${progress}%`));
    toggle.append(el('span', 'prep-plan-chevron', '▾'), title, badges);

    const mini = el('span', 'prep-plan-mini-track');
    const fill = el('i');
    fill.style.width = `${progress}%`;
    mini.append(fill);

    const body = el('div', 'prep-plan-block-body');
    body.id = `plan-body-${plan.id}`;
    body.hidden = Boolean(plan.collapsed);

    const stats = el('div', 'prep-stats');
    stats.append(stat('Tempo até a prova', String(daysLeft), 'dias restantes'), stat('Sessões concluídas', `${done}/${total}`, 'do cronograma'), stat('Progresso', `${progress}%`, 'da preparação'));
    const track = el('div', 'prep-progress-track');
    const trackFill = el('span');
    trackFill.style.width = `${progress}%`;
    track.append(trackFill);

    const schedule = el('div', 'prep-schedule');
    const grouped = new Map();
    plan.sessions.forEach(session => {
      if (!grouped.has(session.date)) grouped.set(session.date, []);
      grouped.get(session.date).push(session);
    });
    const todayString = localDateString(new Date());
    [...grouped.entries()].sort(([x], [y]) => x.localeCompare(y)).forEach(([date, sessions]) => {
      const day = el('article', `prep-day${date === todayString ? ' is-today' : ''}`);
      const heading = el('div', 'prep-day-heading');
      heading.append(el('strong', '', date === todayString ? `Hoje · ${formatDate(date)}` : formatDate(date)), el('span', '', `${sessions.reduce((sum, session) => sum + session.minutes, 0)} min planejados`));
      day.appendChild(heading);
      sessions.forEach(session => {
        const row = el('label', `prep-session${session.done ? ' is-done' : ''}`);
        const checkbox = el('input');
        checkbox.type = 'checkbox';
        checkbox.checked = session.done;
        checkbox.dataset.session = session.id;
        checkbox.setAttribute('aria-label', `Marcar ${session.title} como concluído`);
        checkbox.addEventListener('change', () => {
          session.done = checkbox.checked;
          saveData();
          refreshCard(plan, session.id);
        });
        const copy = el('span', 'prep-session-copy');
        copy.append(el('strong', '', session.title), el('small', '', session.detail));
        row.append(checkbox, copy, el('span', 'prep-session-time', `${session.minutes} min`));
        day.appendChild(row);
      });
      schedule.appendChild(day);
    });

    const actions = el('div', 'prep-results-actions');
    const makeButton = (label, className, handler) => {
      const button = el('button', className, label);
      button.type = 'button';
      button.addEventListener('click', handler);
      return button;
    };
    actions.append(
      makeButton('✎ Editar planejamento', 'prep-secondary-btn', () => { currentPlan = plan; activePlanId = plan.id; startEditing(); }),
      makeButton('↻ Reorganizar pendentes', 'prep-secondary-btn', () => { currentPlan = plan; activePlanId = plan.id; replanPending(); }),
      makeButton('↓ Exportar para calendário', 'prep-secondary-btn', () => { currentPlan = plan; exportCalendar(); }),
      makeButton('Excluir planejamento', 'prep-delete-btn', () => deletePlan(plan))
    );
    body.append(stats, track, schedule, actions);
    if (notice && notice.id === plan.id) {
      const status = el('p', 'prep-plan-notice', notice.text);
      status.setAttribute('role', 'status');
      body.appendChild(status);
      notice = null;
    }

    toggle.addEventListener('click', () => {
      plan.collapsed = !plan.collapsed;
      activePlanId = plan.id;
      card.classList.toggle('is-collapsed', plan.collapsed);
      body.hidden = plan.collapsed;
      toggle.setAttribute('aria-expanded', String(!plan.collapsed));
      toggle.title = plan.collapsed ? 'Expandir planejamento' : 'Minimizar planejamento';
      saveData();
      renderLibrary();
    });
    card.append(toggle, mini, body);
    return card;
  }

  // Atualiza só um cartão (ex.: ao marcar uma sessão), mantendo os outros e o foco no lugar.
  function refreshCard(plan, focusSessionId) {
    const old = findCard(plan.id);
    const fresh = buildPlanCard(plan);
    if (old) old.replaceWith(fresh); else plansContainer.appendChild(fresh);
    renderLibrary();
    if (focusSessionId) {
      const box = [...fresh.querySelectorAll('[data-session]')].find(item => item.dataset.session === focusSessionId);
      if (box) box.focus();
    }
  }

  function renderPlan() {
    currentPlan = plans.find(plan => plan.id === activePlanId) || null;
    results.hidden = !plans.length;
    plansContainer.innerHTML = '';
    plans.slice().sort((x, y) => x.examDate.localeCompare(y.examDate)).forEach(plan => plansContainer.appendChild(buildPlanCard(plan)));
  }

  function renderAll() {
    renderLibrary();
    renderPlan();
  }

  function resetForm() {
    form.reset();
    topicsContainer.innerHTML = '';
    addTopicRow();
    editingPlanId = null;
    cancelEditButton.hidden = true;
    submitButton.innerHTML = 'Montar meu cronograma <span aria-hidden="true">→</span>';
    message.textContent = '';
  }

  function startEditing() {
    if (!currentPlan) return;
    editingPlanId = currentPlan.id;
    subjectInput.value = currentPlan.subject;
    dateInput.value = currentPlan.examDate;
    hoursInput.value = String(currentPlan.hours);
    topicsContainer.innerHTML = '';
    currentPlan.topics.forEach(topic => addTopicRow(topic.name, topic.level, topic.knowledge));
    cancelEditButton.hidden = false;
    submitButton.textContent = 'Salvar alterações';
    message.textContent = 'Edite os dados e salve para atualizar o cronograma.';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function replanPending() {
    if (!currentPlan) return;
    const completed = currentPlan.sessions.filter(session => session.done);
    const pendingTopics = currentPlan.topics.filter(topic => {
      const topicSessions = currentPlan.sessions.filter(session => session.title === topic.name && session.kind === 'topic');
      return !topicSessions.length || topicSessions.some(session => !session.done);
    });
    const freshSessions = pendingTopics.length
      ? generateSchedule({ ...currentPlan, topics: pendingTopics })
      : [{ id: makeId('session'), date: localDateString(new Date()), title: 'Revisão dos pontos principais', detail: 'Revise os assuntos concluídos e retome apenas o que ainda gerar dúvida.', minutes: 30, done: false, kind: 'review' }];
    const completedKeys = new Set(completed.map(session => `${session.date}|${session.title}|${session.kind}`));
    currentPlan.sessions = [...completed, ...freshSessions.filter(session => !completedKeys.has(`${session.date}|${session.title}|${session.kind}`))];
    currentPlan.updatedAt = new Date().toISOString();
    notice = { id: currentPlan.id, text: 'As atividades pendentes foram reorganizadas. Suas tarefas concluídas foram mantidas.' };
    saveData();
    renderAll();
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportCalendar() {
    if (!currentPlan) return;
    const escapeIcs = value => String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const events = currentPlan.sessions.map(session => {
      const date = session.date.replace(/-/g, '');
      const nextDate = localDateString(addDays(parseLocalDate(session.date), 1)).replace(/-/g, '');
      return [
        'BEGIN:VEVENT',
        `UID:${session.id}@centrodefuncionalidades`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${nextDate}`,
        `SUMMARY:${escapeIcs(`${currentPlan.subject}: ${session.title}`)}`,
        `DESCRIPTION:${escapeIcs(`${session.detail} Duração planejada: ${session.minutes} minutos.`)}`,
        'END:VEVENT',
      ].join('\r\n');
    }).join('\r\n');
    const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Centro de Funcionalidades IFPB//Preparacao//PT-BR', 'CALSCALE:GREGORIAN', events, 'END:VCALENDAR'].join('\r\n');
    downloadFile(`cronograma-${currentPlan.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`, calendar, 'text/calendar;charset=utf-8');
  }

  function exportBackup() {
    const backup = { app: 'Centro de Funcionalidades - Preparação para Provas', version: 2, exportedAt: new Date().toISOString(), course, plans, activePlanId };
    downloadFile(`backup-estudos-${course}.json`, JSON.stringify(backup, null, 2), 'application/json');
  }

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.plans)) throw new Error('Formato inválido');
      const restored = parsed.plans.map(normalizePlan).filter(Boolean);
      if (!restored.length) throw new Error('Nenhum planejamento válido foi encontrado');
      if (!window.confirm(`O backup contém ${restored.length} planejamento(s). Deseja substituir os planejamentos salvos neste curso?`)) return;
      plans = restored;
      activePlanId = restored.some(plan => plan.id === parsed.activePlanId) ? parsed.activePlanId : restored[0].id;
      editingPlanId = null;
      saveData();
      resetForm();
      renderAll();
      message.textContent = 'Backup restaurado com sucesso.';
    } catch (error) {
      message.textContent = 'Não foi possível restaurar. Selecione um backup JSON válido deste sistema.';
    }
  }

  form.addEventListener('submit', createOrUpdatePlan);
  document.getElementById('new-plan-button').addEventListener('click', () => {
    resetForm();
    subjectInput.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  cancelEditButton.addEventListener('click', resetForm);
  const setAllCollapsed = value => { plans.forEach(plan => { plan.collapsed = value; }); saveData(); renderAll(); };
  document.getElementById('collapse-all-button').addEventListener('click', () => setAllCollapsed(true));
  document.getElementById('expand-all-button').addEventListener('click', () => setAllCollapsed(false));
  document.getElementById('backup-button').addEventListener('click', exportBackup);
  document.getElementById('restore-button').addEventListener('click', () => document.getElementById('restore-file').click());
  document.getElementById('restore-file').addEventListener('change', event => {
    restoreBackup(event.target.files[0]);
    event.target.value = '';
  });

  // Temporizador Pomodoro: 25 minutos de foco e 5 minutos de pausa.
  const focusTime = document.getElementById('focus-time');
  const focusModeLabel = document.getElementById('focus-mode-label');
  const focusStatus = document.getElementById('focus-status');
  const focusStart = document.getElementById('focus-start');
  const focusReset = document.getElementById('focus-reset');
  const focusSwitch = document.getElementById('focus-switch');
  let focusMode = 'focus';
  let remainingSeconds = 25 * 60;
  let timerEndAt = null;
  let timerInterval = null;

  function renderTimer() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    focusTime.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    focusModeLabel.textContent = focusMode === 'focus' ? 'FOCO' : 'PAUSA';
    focusSwitch.textContent = focusMode === 'focus' ? 'Mudar para pausa de 5 min' : 'Voltar ao foco de 25 min';
  }

  function stopTimer() {
    if (timerInterval) window.clearInterval(timerInterval);
    timerInterval = null;
    timerEndAt = null;
    focusStart.textContent = 'Continuar';
  }

  function updateTimer() {
    remainingSeconds = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
    renderTimer();
    if (remainingSeconds <= 0) {
      stopTimer();
      focusStatus.textContent = focusMode === 'focus' ? 'Sessão concluída! Faça uma pausa.' : 'Pausa concluída! Você pode voltar aos estudos.';
      focusStart.textContent = focusMode === 'focus' ? 'Iniciar pausa' : 'Voltar a estudar';
    }
  }

  focusStart.addEventListener('click', () => {
    if (timerInterval) {
      stopTimer();
      focusStatus.textContent = 'Temporizador pausado.';
      return;
    }
    if (remainingSeconds <= 0) {
      focusMode = focusMode === 'focus' ? 'break' : 'focus';
      remainingSeconds = focusMode === 'focus' ? 25 * 60 : 5 * 60;
      renderTimer();
    }
    timerEndAt = Date.now() + remainingSeconds * 1000;
    timerInterval = window.setInterval(updateTimer, 250);
    focusStart.textContent = 'Pausar';
    focusStatus.textContent = focusMode === 'focus' ? 'Concentre-se na sua sessão.' : 'Descanse um pouco antes de continuar.';
  });

  focusReset.addEventListener('click', () => {
    stopTimer();
    remainingSeconds = focusMode === 'focus' ? 25 * 60 : 5 * 60;
    focusStatus.textContent = 'Temporizador reiniciado.';
    focusStart.textContent = 'Iniciar';
    renderTimer();
  });

  focusSwitch.addEventListener('click', () => {
    stopTimer();
    focusMode = focusMode === 'focus' ? 'break' : 'focus';
    remainingSeconds = focusMode === 'focus' ? 25 * 60 : 5 * 60;
    focusStart.textContent = 'Iniciar';
    focusStatus.textContent = focusMode === 'focus' ? 'Pronto para uma nova sessão.' : 'Hora de fazer uma pausa.';
    renderTimer();
  });

  window.addEventListener('pagehide', () => { if (timerInterval) window.clearInterval(timerInterval); });

  dateInput.min = localDateString(new Date());
  loadData();
  if (!topicsContainer.querySelector('.prep-topic-row')) addTopicRow();
  renderTimer();
  renderAll();
})();
