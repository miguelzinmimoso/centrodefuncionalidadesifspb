// Chaves usadas para recuperar o perfil local e identificar o modo de acesso.
const STUDENT_PROFILE_KEY = 'ifpb-student-profile-v1';
const SESSION_MODE_KEY = 'ifpb-session-mode-v1';
// Liga a validação de credenciais e as mensagens ao formulário atual.
const loginForm = document.querySelector('.form-login');
const loginMessage = loginForm.querySelector('.form-message');
const courseFromQuery = new URLSearchParams(window.location.search).get('curso');
const expectedCourse = courseFromQuery === 'ser' || window.location.pathname.endsWith('login-ser.html')
  ? 'S.E.R.'
  : 'Informática';

// Marca a navegação de visitante para que o painel saiba não exibir perfil autenticado.
document.querySelectorAll('.btn-guest').forEach((guestLink) => {
  guestLink.addEventListener('click', () => {
    window.sessionStorage.setItem(SESSION_MODE_KEY, 'guest');
  });
});

// Intercepta o envio nativo, valida as credenciais salvas localmente e navega apenas se coincidirem.
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';

  const email = loginForm.querySelector('input[type="email"]').value.trim().toLowerCase();
  const enrollment = loginForm.querySelector('input[type="text"]').value.trim();
  const password = loginForm.querySelector('input[autocomplete="current-password"]').value;

  try {
    // Lê e interpreta o único perfil que este protótipo mantém neste navegador.
    const storedProfile = window.localStorage.getItem(STUDENT_PROFILE_KEY);
    if (!storedProfile) {
      loginMessage.textContent = 'Nenhum cadastro foi encontrado neste navegador. Crie uma conta antes de entrar.';
      return;
    }

    const profile = JSON.parse(storedProfile);
    if (!profile || typeof profile !== 'object') {
      loginMessage.textContent = 'Os dados salvos estão inválidos. Faça o cadastro novamente.';
      return;
    }

    if (!profile.passwordHash || !profile.passwordSalt) {
      loginMessage.textContent = 'Este cadastro não possui senha salva. Faça o cadastro novamente.';
      return;
    }

    if (typeof profile.course !== 'string' || profile.course !== expectedCourse) {
      loginMessage.textContent = `Este cadastro pertence ao curso ${profile.course || 'não informado'}. Use o acesso correspondente ao seu curso.`;
      return;
    }

    // Compara e-mail, matrícula e hash da senha; os valores digitados não são enviados a um servidor.
    const passwordHash = await window.studentAuth.hashPassword(password, profile.passwordSalt);
    const credentialsMatch = (
      typeof profile.email === 'string' &&
      typeof profile.enrollment === 'string' &&
      profile.email.trim().toLowerCase() === email &&
      profile.enrollment.trim() === enrollment &&
      passwordHash === profile.passwordHash
    );

    if (!credentialsMatch) {
      loginMessage.textContent = 'E-mail, matrícula ou senha incorretos.';
      return;
    }

    window.sessionStorage.setItem(SESSION_MODE_KEY, 'authenticated');
    window.location.assign(loginForm.action);
  } catch (error) {
    // Exibe falha de leitura/criptografia no próprio formulário, sem permitir o avanço.
    loginMessage.textContent = 'Não foi possível verificar os dados salvos neste navegador.';
  }
});
