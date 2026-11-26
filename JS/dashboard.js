// Chaves independentes para dados de estudo, perfil e modo da sessão no navegador.
const STORAGE_KEY = 'ifpb-study-planner-v1';
const GOALS_KEY = 'ifpb-daily-goals-v1';
const PROFILE_KEY = 'ifpb-study-profile-v1';
const STUDENT_DATA_KEY = 'ifpb-student-profile-v1';
const SESSION_MODE_KEY = 'ifpb-session-mode-v1';

// Converte a data local atual para YYYY-MM-DD, evitando diferença de fuso horário.
function getTodayISO() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60000);
  return localDate.toISOString().split('T')[0];
}

// Recupera e saneia tarefas persistidas para evitar dados inválidos na tela.
function getStoredTasks() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }

    const seededTaskIds = new Set(['task-1', 'task-2', 'task-3']);
    const cleaned = parsed.filter((task) => (
      task &&
      typeof task.title === 'string' &&
      task.title.trim() &&
      !seededTaskIds.has(task.id)
    ));

    if (cleaned.length !== parsed.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch (error) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return [];
  }
}

let tasks = getStoredTasks();

// Recupera objetivos salvos e remove entradas vazias ou em formato inesperado.
function getStoredGoals() {
  try {
    const stored = window.localStorage.getItem(GOALS_KEY);
    if (!stored) {
      window.localStorage.setItem(GOALS_KEY, JSON.stringify([]));
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      window.localStorage.setItem(GOALS_KEY, JSON.stringify([]));
      return [];
    }

    const cleaned = parsed.filter((goal) => typeof goal === 'string' && goal.trim());

    if (cleaned.length !== parsed.length) {
      window.localStorage.setItem(GOALS_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch (error) {
    window.localStorage.setItem(GOALS_KEY, JSON.stringify([]));
    return [];
  }
}

let dailyGoals = getStoredGoals();

// Lê as preferências de estudo e aplica valores seguros se o armazenamento estiver inválido.
function getStoredProfile() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || '{}');
    const stored = parsed && typeof parsed === 'object' ? parsed : {};
    const hours = Number(stored.dailyHours);
    return {
      dailyHours: Number.isFinite(hours) && hours >= 0.5 && hours <= 24 ? hours : null,
      nextExamSubject: typeof stored.nextExamSubject === 'string' ? stored.nextExamSubject.trim().slice(0, 40) : '',
      nextExamDate: typeof stored.nextExamDate === 'string' ? stored.nextExamDate : '',
    };
  } catch (error) {
    return { dailyHours: null, nextExamSubject: '', nextExamDate: '' };
  }
}

let studyProfile = getStoredProfile();

// Escapa caracteres especiais antes de inserir texto do usuário em marcação HTML.
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

// Persiste as partes do perfil de estudo e dos objetivos em chaves separadas.
function saveProfile() {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(studyProfile));
}

function saveGoals() {
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(dailyGoals));
}

// Atualiza a lista visual de objetivos, escapando o texto digitado pelo estudante.
function renderDailyGoals() {
  const goalsList = document.getElementById('daily-goals-list');
  if (!goalsList) return;

  if (!dailyGoals.length) {
    goalsList.innerHTML = '<li class="goal-empty">Ainda não há objetivos salvos para hoje.</li>';
    return;
  }

  goalsList.innerHTML = dailyGoals
    .map(
      (goal, index) => `
        <li class="goal-item">
          <span class="goal-bullet"></span>
          <span class="goal-text">${escapeHTML(goal)}</span>
          <button type="button" class="goal-remove" data-index="${index}">Excluir</button>
        </li>
      `
    )
    .join('');
}

// Insere um objetivo no início da lista e limita a quantidade exibida a cinco.
function addGoal(value) {
  const cleanGoal = value.trim();
  if (!cleanGoal) return;

  dailyGoals = [cleanGoal, ...dailyGoals].slice(0, 5);
  saveGoals();
  renderDailyGoals();
}

// Remove um objetivo pelo índice da lista renderizada e sincroniza a tela e o armazenamento.
function removeGoal(index) {
  dailyGoals = dailyGoals.filter((_, itemIndex) => itemIndex !== index);
  saveGoals();
  renderDailyGoals();
}

// Persiste as tarefas do planner após inclusão, conclusão ou exclusão.
function saveTasks() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Formata datas de tarefas no padrão curto usado pela interface em português.
function formatDate(dateValue) {
  if (!dateValue) {
    return 'Sem data';
  }

  const date = new Date(dateValue + 'T12:00:00');
  if (Number.isNaN(date.getTime())) {
    return 'Sem data';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).format(date);
}

// Mostra até três tarefas ainda não concluídas na agenda resumida.
function renderAgenda() {
  const agendaList = document.getElementById('agenda-list');
  if (!agendaList) return;

  const visibleTasks = tasks.filter(task => !task.done).slice(0, 3);

  if (!visibleTasks.length) {
    agendaList.innerHTML = '<li><span class="dot green"></span> Nenhuma tarefa pendente. Aproveite para revisar.</li>';
    return;
  }

  agendaList.innerHTML = visibleTasks
    .map(
      (task) => `
        <li>
          <span class="dot ${task.done ? 'green' : 'orange'}"></span>
          ${escapeHTML(task.title)}
        </li>
      `
    )
    .join('');
}

// Atualiza horas, próxima prova e total de tarefas pendentes no resumo do painel.
function renderOverviewStats() {
  const hoursValue = document.getElementById('daily-hours-value');
  const examValue = document.getElementById('next-exam-value');
  const examSubject = document.getElementById('next-exam-subject');
  const pendingValue = document.getElementById('pending-tasks-value');

  if (hoursValue) {
    hoursValue.textContent = studyProfile.dailyHours
      ? `${studyProfile.dailyHours}h`
      : 'Não informada';
  }

  const today = getTodayISO();
  const upcomingExams = tasks
    .filter((task) => task.type === 'exam' && task.date && task.date >= today)
    .map((task) => ({ subject: task.subject, date: task.date }));

  if (studyProfile.nextExamDate >= today && studyProfile.nextExamSubject.trim()) {
    upcomingExams.push({
      subject: studyProfile.nextExamSubject,
      date: studyProfile.nextExamDate,
    });
  }

  const nextExam = upcomingExams.sort((first, second) => first.date.localeCompare(second.date))[0];

  if (examValue && examSubject) {
    if (nextExam) {
      const daysUntil = Math.round(
        (new Date(`${nextExam.date}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000
      );
      examValue.textContent = daysUntil === 0 ? 'Hoje' : `Em ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`;
      examSubject.textContent = `${nextExam.subject || 'Matéria não informada'} · ${formatDate(nextExam.date)}`;
    } else {
      examValue.textContent = 'Não informada';
      examSubject.textContent = 'Cadastre uma prova no planner';
    }
  }

  if (pendingValue) {
    pendingValue.textContent = String(tasks.filter((task) => !task.done).length);
  }
}

// Calcula a proporção de tarefas concluídas e atualiza a barra de progresso.
function renderProgress() {
  const percentageNode = document.getElementById('progress-percent');
  const fillNode = document.getElementById('progress-bar-fill');
  const messageNode = document.getElementById('progress-message');

  if (!percentageNode || !fillNode || !messageNode) return;

  const doneCount = tasks.filter(task => task.done).length;
  const totalCount = tasks.length || 1;
  const percent = Math.round((doneCount / totalCount) * 100);

  percentageNode.textContent = `${percent}%`;
  fillNode.style.width = `${percent}%`;

  if (percent >= 80) {
    messageNode.textContent = 'Excelente! Você está muito bem encaminhado.';
  } else if (percent >= 50) {
    messageNode.textContent = 'Bom progresso. Falta pouco para fechar a semana.';
  } else if (percent > 0) {
    messageNode.textContent = 'Você já começou bem. Continue com foco na próxima tarefa.';
  } else {
    messageNode.textContent = 'Comece adicionando suas primeiras tarefas de estudo.';
  }
}

// Reconstrói as linhas da planilha; títulos e matérias do usuário são escapados antes da renderização.
function renderPlannerList() {
  const plannerList = document.getElementById('planner-list');
  if (!plannerList) return;

  if (!tasks.length) {
    plannerList.innerHTML = '<div class="planner-item"><span class="task-title">Nenhuma tarefa cadastrada.</span></div>';
    return;
  }

  plannerList.innerHTML = tasks
    .map(
      (task) => `
        <div class="planner-item ${task.done ? 'done' : ''}">
          <input type="checkbox" data-id="${task.id}" ${task.done ? 'checked' : ''}>
          <span class="task-title">${escapeHTML(task.title)}</span>
          <span class="task-subject">${escapeHTML(task.subject || 'Estudo geral')}</span>
          <span class="task-date">${formatDate(task.date)}</span>
          <span class="task-type">${task.type === 'exam' ? 'Prova' : 'Estudo'}</span>
          <button type="button" class="task-remove" data-id="${task.id}">Excluir</button>
        </div>
      `
    )
    .join('');
}

// Recalcula todos os blocos dependentes da lista de tarefas em uma única atualização.
function renderAll() {
  renderAgenda();
  renderProgress();
  renderPlannerList();
  renderOverviewStats();
}

// Cria uma tarefa com identificador próprio, salva e redesenha os componentes relacionados.
function addTask(title, subject, date, type) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  tasks.unshift({
    id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: cleanTitle,
    subject: subject.trim() || 'Estudo geral',
    date: date || getTodayISO(),
    type,
    done: false,
  });

  saveTasks();
  renderAll();
}

// Alterna o estado concluído de uma tarefa selecionada por seu identificador.
function toggleTask(taskId) {
  tasks = tasks.map((task) => {
    if (task.id === taskId) {
      return { ...task, done: !task.done };
    }
    return task;
  });

  saveTasks();
  renderAll();
}

// Exclui a tarefa indicada e sincroniza novamente o planner e os resumos.
function removeTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderAll();
}

// Preenche o diálogo de perfil a partir do armazenamento local e do modo de sessão atual.
function renderStudentProfile() {
  const fields = {
    name: document.getElementById('profile-name'),
    enrollment: document.getElementById('profile-enrollment'),
    course: document.getElementById('profile-course'),
    email: document.getElementById('profile-email'),
    birthDate: document.getElementById('profile-birth-date'),
  };
  const photo = document.getElementById('profile-photo');
  const initials = document.getElementById('profile-initials');
  const emptyMessage = document.getElementById('profile-empty-message');
  const logoutButton = document.getElementById('logout-account');
  const isAuthenticated = window.sessionStorage.getItem(SESSION_MODE_KEY) === 'authenticated';
  const expectedCourse = window.location.pathname.endsWith('dashboard-ser.html')
    ? 'S.E.R.'
    : 'Informática';
  let student = null;

  try {
    student = JSON.parse(window.localStorage.getItem(STUDENT_DATA_KEY) || 'null');
  } catch (error) {
    student = null;
  }

  const hasProfile = isAuthenticated &&
    student &&
    typeof student === 'object' &&
    student.course === expectedCourse;
  logoutButton.hidden = !isAuthenticated;
  fields.name.textContent = hasProfile && student.name ? student.name : 'Não informado';
  fields.enrollment.textContent = hasProfile && student.enrollment ? student.enrollment : 'Não informada';
  fields.course.textContent = hasProfile && student.course ? student.course : 'Não informado';
  fields.email.textContent = hasProfile && student.email ? student.email : 'Não informado';

  if (hasProfile && student.birthDate) {
    const birthDate = new Date(`${student.birthDate}T12:00:00`);
    fields.birthDate.textContent = Number.isNaN(birthDate.getTime())
      ? 'Não informada'
      : new Intl.DateTimeFormat('pt-BR').format(birthDate);
  } else {
    fields.birthDate.textContent = 'Não informada';
  }

  if (hasProfile && typeof student.photo === 'string' && student.photo.startsWith('data:image/')) {
    photo.src = student.photo;
    photo.hidden = false;
    initials.hidden = true;
  } else {
    photo.removeAttribute('src');
    photo.hidden = true;
    initials.hidden = false;
  }

  const nameParts = hasProfile && student.name ? student.name.trim().split(/\s+/) : [];
  initials.textContent = nameParts.length
    ? `${nameParts[0][0]}${nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : ''}`.toUpperCase()
    : 'IF';
  emptyMessage.hidden = Boolean(hasProfile);
}

// Liga os eventos do diálogo, formulários e listas; é o ponto de inicialização do painel.
function initializePlanner() {
  const profileDialog = document.getElementById('student-profile-dialog');
  const openProfileButton = document.getElementById('open-student-profile');
  const closeProfileButton = document.getElementById('close-student-profile');

  // Atualiza os dados antes de abrir o modal para mostrar sempre o perfil mais recente.
  openProfileButton.addEventListener('click', () => {
    renderStudentProfile();
    profileDialog.showModal();
  });
  document.getElementById('logout-account').addEventListener('click', () => {
    window.sessionStorage.removeItem(SESSION_MODE_KEY);
    window.location.assign('../index.html');
  });
  closeProfileButton.addEventListener('click', () => profileDialog.close());
  profileDialog.addEventListener('click', (event) => {
    if (event.target === profileDialog) profileDialog.close();
  });

  const hoursInput = document.getElementById('daily-hours-input');
  const examSubjectInput = document.getElementById('daily-exam-subject');
  const examDateInput = document.getElementById('daily-exam-date');
  if (hoursInput && studyProfile.dailyHours) {
    hoursInput.value = String(studyProfile.dailyHours);
  }
  if (examSubjectInput) examSubjectInput.value = studyProfile.nextExamSubject;
  if (examDateInput) examDateInput.value = studyProfile.nextExamDate;

  // Ao enviar o plano diário, salva preferências, registra o foco e atualiza o resumo.
  const goalsForm = document.getElementById('daily-goals-form');
  if (goalsForm) {
    goalsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const goalInput = document.getElementById('daily-goal-input');

      if (goalInput && hoursInput) {
        studyProfile.dailyHours = Number(hoursInput.value);
        studyProfile.nextExamSubject = examSubjectInput.value.trim();
        studyProfile.nextExamDate = examDateInput.value;
        saveProfile();
        addGoal(goalInput.value);
        goalInput.value = '';
        renderOverviewStats();
        goalInput.focus();
      }
    });
  }

  // O tipo Prova torna a data obrigatória; o submit valida, insere a tarefa e limpa os campos.
  const form = document.getElementById('study-form');
  if (form) {
    const dateInput = document.getElementById('task-date');
    const typeInput = document.getElementById('task-type');

    typeInput.addEventListener('change', () => {
      dateInput.required = typeInput.value === 'exam';
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const titleInput = document.getElementById('task-title');
      const subjectInput = document.getElementById('task-subject');

      if (typeInput.value === 'exam' && !dateInput.value) {
        dateInput.required = true;
        dateInput.reportValidity();
        return;
      }

      addTask(titleInput.value, subjectInput.value, dateInput.value, typeInput.value);
      form.reset();
      dateInput.required = false;
      titleInput.focus();
    });
  }

  // Delegação de eventos permite excluir objetivos/tarefas criados dinamicamente.
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const goalRemoveButton = target.closest('.goal-remove');
    if (goalRemoveButton) {
      removeGoal(Number(goalRemoveButton.dataset.index));
      return;
    }

    const removeButton = target.closest('.task-remove');
    if (removeButton) {
      removeTask(removeButton.dataset.id);
    }
  });

  // Delegação para caixas de seleção atualiza o estado de conclusão das tarefas.
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.matches('input[type="checkbox"][data-id]')) {
      toggleTask(target.dataset.id);
    }
  });

  renderDailyGoals();
  renderAll();
}

// Registra os listeners e desenha os dados persistidos assim que o script é carregado.
initializePlanner();
