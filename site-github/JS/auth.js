(() => {
  // Produz um resumo SHA-256 da senha junto ao salt aleatório criado para o cadastro.
  async function hashPassword(password, salt) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Criptografia local indisponível neste navegador.');
    }
    const encodedPassword = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await window.crypto.subtle.digest('SHA-256', encodedPassword);

    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Gera um salt criptograficamente aleatório e o converte para hexadecimal.
  function createSalt() {
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    return Array.from(salt, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Expõe as rotinas ao formulário sem criar variáveis globais adicionais.
  window.studentAuth = { createSalt, hashPassword };
})();

