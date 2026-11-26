// Identificador do perfil salvo e tamanho máximo permitido para a foto original.
const STUDENT_PROFILE_KEY = 'ifpb-student-profile-v1';
const MAX_PHOTO_SIZE = 8 * 1024 * 1024;

// Campos e mensagens da página usados pelos eventos de cadastro.
const registrationForm = document.getElementById('student-register-form');
const photoInput = document.getElementById('register-photo');
const photoPreview = document.getElementById('student-photo-preview');
const photoPlaceholder = document.getElementById('student-photo-placeholder');
const registrationMessage = document.getElementById('register-message');
let photoPreviewUrl = null;

// O curso escolhido na página inicial é carregado e salvo sem ser digitado novamente.
const courseByKey = {
  informatica: 'Informática',
  ser: 'S.E.R.',
};
const courseKey = new URLSearchParams(window.location.search).get('curso');
const selectedCourse = Object.prototype.hasOwnProperty.call(courseByKey, courseKey)
  ? courseByKey[courseKey]
  : '';
document.getElementById('register-course').value = selectedCourse;

// Mantém o retorno ao login e a edição de perfil associados ao curso selecionado.
if (courseKey === 'ser') {
  document.getElementById('back-to-login').href = 'login-ser.html?curso=ser';
} else if (courseKey === 'informatica') {
  document.getElementById('back-to-login').href = 'login.html?curso=informatica';
}

// Atualiza a região de status e sua aparência conforme sucesso ou erro.
function showRegistrationMessage(message, isError = false) {
  registrationMessage.textContent = message;
  registrationMessage.classList.toggle('error', isError);
}

// Cria a prévia temporária do arquivo escolhido e libera a URL anterior para não acumular recursos.
function previewPhoto(file) {
  if (photoPreviewUrl) {
    URL.revokeObjectURL(photoPreviewUrl);
    photoPreviewUrl = null;
  }

  photoPreviewUrl = URL.createObjectURL(file);
  photoPreview.src = photoPreviewUrl;
  photoPreview.hidden = false;
  photoPlaceholder.hidden = true;
}

// Remove a prévia e o arquivo selecionado quando a foto for limpa ou inválida.
function clearPhoto() {
  if (photoPreviewUrl) {
    URL.revokeObjectURL(photoPreviewUrl);
    photoPreviewUrl = null;
  }
  photoInput.value = '';
  photoPreview.removeAttribute('src');
  photoPreview.hidden = true;
  photoPlaceholder.hidden = false;
}

// Redimensiona a imagem no navegador para reduzir o espaço ocupado no armazenamento local.
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const fileReader = new FileReader();

    fileReader.addEventListener('load', () => {
      image.src = fileReader.result;
    });
    fileReader.addEventListener('error', () => reject(new Error('Não foi possível abrir a foto.')));
    image.addEventListener('load', () => {
      // Reduz a maior dimensão para 480px antes de armazenar a imagem em JPEG.
      const maxDimension = 480;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Seu navegador não conseguiu processar esta imagem.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    });
    image.addEventListener('error', () => reject(new Error('Este arquivo de imagem não pôde ser carregado.')));
    fileReader.readAsDataURL(file);
  });
}

// Valida o tipo e o tamanho da foto no evento change, antes de tentar salvar o cadastro.
photoInput.addEventListener('change', () => {
  const [file] = photoInput.files;
  if (!file) {
    clearPhoto();
    return;
  }

  if (!file.type.startsWith('image/')) {
    clearPhoto();
    showRegistrationMessage('Escolha um arquivo de imagem.', true);
    return;
  }

  if (file.size > MAX_PHOTO_SIZE) {
    clearPhoto();
    showRegistrationMessage('A foto deve ter no máximo 8 MB.', true);
    return;
  }

  showRegistrationMessage('');
  previewPhoto(file);
});

// Controla o envio do formulário: prepara a foto e a senha, armazena o perfil e abre o painel do curso.
registrationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedCourse) {
    showRegistrationMessage('Selecione um curso na página inicial antes de continuar.', true);
    return;
  }

  showRegistrationMessage('Salvando os dados...');

  const photoFile = photoInput.files[0];
  let photo = '';

  // Só converte a imagem quando o campo opcional foi preenchido.
  if (photoFile) {
    try {
      photo = await resizePhoto(photoFile);
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      showRegistrationMessage(`Não foi possível processar a foto.${detail}`, true);
      return;
    }
  }

  let salt;
  let passwordHash;
  try {
    salt = window.studentAuth.createSalt();
    passwordHash = await window.studentAuth.hashPassword(
      document.getElementById('register-password').value,
      salt
    );
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    showRegistrationMessage(`Não foi possível proteger a senha.${detail}`, true);
    return;
  }

  const profile = {
    name: document.getElementById('register-name').value.trim(),
    enrollment: document.getElementById('register-enrollment').value.trim(),
    course: selectedCourse,
    email: document.getElementById('register-email').value.trim(),
    birthDate: document.getElementById('register-birth-date').value,
    passwordHash,
    passwordSalt: salt,
    photo,
  };

  try {
    // Salva o perfil e a sessão no navegador atual; não há envio a servidor ou autenticação remota.
    window.localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(profile));
    window.sessionStorage.setItem('ifpb-session-mode-v1', 'authenticated');
  } catch (error) {
    const message = error && error.name === 'QuotaExceededError'
      ? 'O armazenamento deste navegador está cheio. Libere espaço e tente novamente.'
      : 'O navegador não permitiu salvar os dados. Verifique as permissões de armazenamento e tente novamente.';
    showRegistrationMessage(message, true);
    return;
  }

  showRegistrationMessage('Dados do aluno salvos neste navegador.');
  const dashboardPath = new URLSearchParams(window.location.search).get('curso') === 'ser'
    ? 'dashboard-ser.html'
    : 'dashboard.html';
  window.location.assign(dashboardPath);
});
