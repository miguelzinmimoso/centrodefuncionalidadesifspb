// Referências aos formulários, navegação e áreas de resultado da calculadora.
const MINIMUM_PASSING_AVERAGE = 70;
const MINIMUM_FINAL_AVERAGE = 50;
const averageForm = document.querySelector('#average-form');
const calculationTabs = document.querySelectorAll('.calculation-tab');
const calculationPanels = document.querySelectorAll('.calculation-panel');
const addBimonthlyGradeButton = document.querySelector('#add-bimonthly-grade');
const bimonthlyGrades = document.querySelector('#bimonthly-grades');
const disciplineCount = document.querySelector('#discipline-count');
const disciplineList = document.querySelector('#discipline-list');
const generateDisciplinesButton = document.querySelector('#generate-disciplines');
const averageResult = document.querySelector('#average-result');
const resultLabel = document.querySelector('#result-label');
const formMessage = document.querySelector('#form-message');
const dashboardLink = document.querySelector('#back-to-dashboard');

// Mantém o retorno para o dashboard S.E.R. quando a calculadora veio desse curso.
if (new URLSearchParams(window.location.search).get('curso') === 'ser') {
  dashboardLink.href = 'dashboard-ser.html';
  dashboardLink.textContent = 'Voltar ao painel S.E.R.';
}

// Limpa resultados e erros antigos ao trocar de modalidade de cálculo.
function resetResult() {
  averageResult.textContent = '--';
  resultLabel.textContent = 'Preencha as notas para começar.';
  resultLabel.classList.remove('below-minimum');
  formMessage.textContent = '';
}

// Exibe somente o bloco selecionado e atualiza o estado visual dos botões.
calculationTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    calculationTabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });

    calculationPanels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab.dataset.calculation;
    });
    resetResult();
  });
});

// A opção ponderada revela os campos de peso apenas no bloco correspondente.
document.querySelectorAll('.average-types input[type="radio"]').forEach((input) => {
  input.addEventListener('change', () => {
    const panel = input.closest('.calculation-panel');
    const gradesList = panel.querySelector('.grades-list');
    gradesList.classList.toggle('weighted', input.value === 'weighted');
  });
});

// Cria uma linha de nota para a opção de adicionar itens ao cálculo bimestral.
function createGradeRow(number) {
  const row = document.createElement('div');
  const gradeId = `bimonthly-grade-${number}`;
  const weightId = `bimonthly-weight-${number}`;
  row.className = 'grade-row';
  row.innerHTML = `
    <label for="${gradeId}">Nota ${number}</label>
    <input id="${gradeId}" class="grade-input" type="number" min="0" max="100" step="0.01" placeholder="0,00" required>
    <label class="weight-control" for="${weightId}">Peso</label>
    <input id="${weightId}" class="weight-input weight-control" type="number" min="0.01" step="0.01" placeholder="1">
  `;
  return row;
}

// Numera a nova nota com base na quantidade atual de linhas.
addBimonthlyGradeButton.addEventListener('click', () => {
  const nextNumber = bimonthlyGrades.querySelectorAll('.grade-row').length + 1;
  bimonthlyGrades.appendChild(createGradeRow(nextNumber));
});

// Cria os campos de nota final e carga horária de uma disciplina do CRE.
function createDisciplineRow(number) {
  const row = document.createElement('div');
  const gradeId = `discipline-grade-${number}`;
  const hoursId = `discipline-hours-${number}`;
  row.className = 'discipline-row';
  row.innerHTML = `
    <label for="${gradeId}">Disciplina ${number} — nota final
      <input id="${gradeId}" class="discipline-grade" type="number" min="0" max="100" step="0.01" placeholder="0,00" required>
    </label>
    <label for="${hoursId}">Carga horária
      <input id="${hoursId}" class="discipline-hours" type="number" min="0.01" step="0.01" placeholder="Ex.: 80" required>
    </label>
  `;
  return row;
}

// Gera um campo para cada disciplina solicitada, validando a quantidade antes.
generateDisciplinesButton.addEventListener('click', () => {
  const count = Number(disciplineCount.value);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    formMessage.textContent = 'Informe uma quantidade de disciplinas entre 1 e 100.';
    return;
  }

  disciplineList.innerHTML = '';
  for (let number = 1; number <= count; number += 1) {
    disciplineList.appendChild(createDisciplineRow(number));
  }
  formMessage.textContent = '';
  averageResult.textContent = '--';
  resultLabel.textContent = 'Preencha a nota e a carga horária de cada disciplina.';
});

// Valida as notas e calcula a média bimestral ou anual, aritmética ou ponderada.
function calculateGradeAverage(panel, mode) {
  const rows = [...panel.querySelectorAll('.grade-row')];
  const values = rows.map((row) => {
    const gradeInput = row.querySelector('.grade-input');
    const weightInput = row.querySelector('.weight-input');
    return {
      gradeInput,
      weightInput,
      grade: Number(gradeInput.value),
      weight: weightInput ? Number(weightInput.value) : 1,
    };
  });

  if (values.some(({ gradeInput, grade }) => (
    gradeInput.value === '' || !Number.isFinite(grade) || grade < 0 || grade > 100
  ))) {
    return { error: 'Preencha todas as notas com valores entre 0 e 100.' };
  }

  if (mode === 'weighted') {
    if (values.some(({ weightInput, weight }) => (
      !weightInput || weightInput.value === '' || !Number.isFinite(weight) || weight <= 0
    ))) {
      return { error: 'Informe pesos maiores que zero para todas as notas.' };
    }

    const totalWeight = values.reduce((total, item) => total + item.weight, 0);
    return {
      value: values.reduce((total, item) => total + item.grade * item.weight, 0) / totalWeight,
      label: panel.dataset.panel === 'annual' ? 'Média anual ponderada' : 'Média bimestral ponderada',
    };
  }

  return {
    value: values.reduce((total, item) => total + item.grade, 0) / values.length,
    label: panel.dataset.panel === 'annual' ? 'Média anual aritmética' : 'Média bimestral aritmética',
  };
}

// Calcula o CRE usando as cargas horárias como pesos das notas finais.
function calculateCre() {
  const rows = [...disciplineList.querySelectorAll('.discipline-row')];
  const requestedCount = Number(disciplineCount.value);
  if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 100) {
    return { error: 'Informe uma quantidade de disciplinas entre 1 e 100.' };
  }
  if (rows.length !== requestedCount) {
    return { error: 'Clique em “Criar campos” para gerar os dados das disciplinas.' };
  }

  const values = rows.map((row) => {
    const gradeInput = row.querySelector('.discipline-grade');
    const hoursInput = row.querySelector('.discipline-hours');
    return {
      gradeInput,
      hoursInput,
      grade: Number(gradeInput.value),
      hours: Number(hoursInput.value),
    };
  });

  if (values.some(({ gradeInput, grade }) => (
    gradeInput.value === '' || !Number.isFinite(grade) || grade < 0 || grade > 100
  ))) {
    return { error: 'Informe a nota final de cada disciplina entre 0 e 100.' };
  }
  if (values.some(({ hoursInput, hours }) => (
    hoursInput.value === '' || !Number.isFinite(hours) || hours <= 0
  ))) {
    return { error: 'Informe uma carga horária maior que zero para cada disciplina.' };
  }

  const totalHours = values.reduce((total, item) => total + item.hours, 0);
  return {
    value: values.reduce((total, item) => total + item.grade * item.hours, 0) / totalHours,
    label: 'CRE ponderado pela carga horária',
  };
}

// Intercepta o envio e executa somente o cálculo do bloco atualmente visível.
averageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  formMessage.textContent = '';
  const activePanel = [...calculationPanels].find((panel) => !panel.hidden);
  const result = activePanel.dataset.panel === 'cre'
    ? calculateCre()
    : calculateGradeAverage(
      activePanel,
      activePanel.querySelector('input[type="radio"]:checked').value
    );

  if (result.error) {
    averageResult.textContent = '--';
    resultLabel.textContent = 'Corrija os campos para calcular.';
    resultLabel.classList.remove('below-minimum');
    formMessage.textContent = result.error;
    return;
  }

  const displayedAverage = Number(result.value.toFixed(2));
  averageResult.textContent = displayedAverage.toFixed(2).replace('.', ',');
  if (activePanel.dataset.panel === 'annual' && displayedAverage < MINIMUM_PASSING_AVERAGE) {
    const annualAverageCents = Math.round(displayedAverage * 100);
    const requiredFinalScore = Math.ceil(
      (MINIMUM_FINAL_AVERAGE * 1000 - annualAverageCents * 6) / 4
    ) / 100;
    const formattedFinalScore = requiredFinalScore.toFixed(2).replace('.', ',');

    if (requiredFinalScore > 100) {
      resultLabel.textContent = `${result.label}. Seria necessário tirar ${formattedFinalScore} na avaliação final, acima do máximo de 100; não é possível alcançar a média final mínima de ${MINIMUM_FINAL_AVERAGE}.`;
    } else {
      resultLabel.textContent = `${result.label}. Para alcançar a média final mínima de ${MINIMUM_FINAL_AVERAGE}, precisa tirar pelo menos ${formattedFinalScore} na avaliação final.`;
    }
    resultLabel.classList.add('below-minimum');
  } else if (activePanel.dataset.panel === 'annual') {
    resultLabel.textContent = `${result.label}. Média mínima de ${MINIMUM_PASSING_AVERAGE} atingida; aprovado diretamente.`;
    resultLabel.classList.remove('below-minimum');
  } else if (activePanel.dataset.panel !== 'cre' && displayedAverage < MINIMUM_PASSING_AVERAGE) {
    const missingPoints = (MINIMUM_PASSING_AVERAGE - displayedAverage)
      .toFixed(2)
      .replace('.', ',');
    resultLabel.textContent = `${result.label}. Faltam ${missingPoints} pontos para atingir a média mínima de ${MINIMUM_PASSING_AVERAGE}.`;
    resultLabel.classList.add('below-minimum');
  } else {
    resultLabel.textContent = result.label;
    resultLabel.classList.remove('below-minimum');
  }
});
