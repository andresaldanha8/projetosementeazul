'use strict';

// Cliente real de autenticação que usa os endpoints PHP via sessão HTTP-only.
// Estado permitido somente em memória enquanto a página estiver aberta.
window.authService = (() => {
  let currentUser = null; // { id, nome, perfil } em memória
  let mustChangePassword = false; // boolean
  let csrfToken = null; // string em memória

  function clearState() {
    currentUser = null;
    mustChangePassword = false;
    csrfToken = null;
  }

  function copyPublicUser(u) {
    return { id: u.id, nome: u.nome, perfil: u.perfil };
  }

  function isValidPublicUser(obj) {
    return obj && typeof obj === 'object' && ('id' in obj) && ('nome' in obj) && ('perfil' in obj);
  }

  async function safeParseJson(response) {
    try {
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  function applyAuthResponse(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Resposta de autenticação inválida.');
    }

    const user = data.usuario || data.user || data.usuarioPublico || null;
    if (!isValidPublicUser(user)) {
      throw new Error('Resposta de autenticação inválida.');
    }

    currentUser = copyPublicUser(user);
    mustChangePassword = Boolean(data.mustChangePassword);
    csrfToken =
      typeof data.csrfToken === 'string' && data.csrfToken.length > 0
        ? data.csrfToken
        : null;
  }

  async function login(login, password) {
    clearState();
    if (typeof login !== 'string') throw new Error('Login inválido.');
    if (typeof password !== 'string') throw new Error('Senha inválida.');

    let resp;
    try {
      resp = await fetch('/cadastro/api/auth/login.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
      });
    } catch (e) {
      clearState();
      throw new Error('Falha de rede ao tentar autenticar.');
    }

    const data = await safeParseJson(resp) || {};

    if (resp.status === 200) {
      try {
        applyAuthResponse(data);
        return { ...currentUser };
      } catch (e) {
        clearState();
        throw new Error('Resposta de autenticação inválida.');
      }
    }

    // Erros previstos do servidor
    if (resp.status === 400 || resp.status === 401) {
      clearState();
      const msg = (data && (data.mensagem || data.message)) ? String(data.mensagem || data.message) : 'Login ou senha inválidos.';
      throw new Error(msg);
    }

    // Outros erros
    clearState();
    throw new Error('Erro no servidor ao autenticar. Tente novamente mais tarde.');
  }

  async function getCurrentUser() {
    try {
      const resp = await fetch('/cadastro/api/auth/me.php', { method: 'GET', credentials: 'same-origin' });
      const data = await safeParseJson(resp) || {};

      if (resp.status === 200) {
        try {
          applyAuthResponse(data);
          return { ...currentUser };
        } catch {
          clearState();
          throw new Error('Resposta inválida ao obter o usuário.');
        }
      }

      if (resp.status === 401) {
        clearState();
        return null; // fluxo normal: não lançar
      }

      // outros códigos: limpar estado e lançar erro técnico
      clearState();
      throw new Error('Falha ao verificar sessão. Tente recarregar a página.');
    } catch (e) {
      // Se for uma falha de rede, propagar como erro genérico
      if (e instanceof Error && e.message && e.message.startsWith('Falha de rede')) {
        throw e;
      }
      throw e;
    }
  }

  async function isAuthenticated() {
    try {
      return Boolean(await getCurrentUser());
    } catch (e) {
      // Não mascarar erro técnico como não autenticado
      throw e;
    }
  }

  async function logout() {
    // Usar csrfToken apenas se disponível
    const headers = {};
    if (typeof csrfToken === 'string' && csrfToken.length > 0) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    let resp;
    try {
      resp = await fetch('/cadastro/api/auth/logout.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers
      });
    } catch (e) {
      // rede: não afirmar que logout ocorreu no servidor
      throw new Error('Falha de rede ao desconectar.');
    }

    if (resp.status === 200) {
      clearState();
      return;
    }

    if (resp.status === 401) {
      clearState();
      return;
    }

    if (resp.status === 403) {
      throw new Error('Requisição não autorizada.');
    }

    throw new Error('Erro ao desconectar. Tente novamente.');
  }

  async function changePassword(currentPassword, newPassword) {
    if (typeof csrfToken !== 'string' || csrfToken.length === 0) {
      throw new Error('Sessão inválida. Recarregue a página e entre novamente.');
    }
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      throw new Error('Parâmetros de senha inválidos.');
    }

    let resp;
    try {
      resp = await fetch('/cadastro/api/auth/change_password.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ currentPassword, newPassword })
      });
    } catch (e) {
      clearState();
      throw new Error('Não foi possível confirmar a troca de senha. Entre novamente para continuar.');
    }

    const data = await safeParseJson(resp) || {};

    if (resp.status === 200) {
      try {
        // Expect: { sucesso: true, usuario: {...}, mustChangePassword: false, csrfToken: 'NOVO' }
        if (!data || data.sucesso !== true) {
          clearState();
          throw new Error('Resposta inválida ao trocar senha.');
        }
        if (!isValidPublicUser(data.usuario)) {
          clearState();
          throw new Error('Resposta inválida ao trocar senha.');
        }
        currentUser = copyPublicUser(data.usuario);
        mustChangePassword = Boolean(data.mustChangePassword);
        csrfToken = (typeof data.csrfToken === 'string' && data.csrfToken.length > 0) ? data.csrfToken : null;
        return { ...currentUser };
      } catch (e) {
        clearState();
        throw new Error('Resposta inválida ao trocar senha.');
      }
    }

    if (resp.status === 400) {
      const msg = (data && (data.mensagem || data.message)) ? String(data.mensagem || data.message) : 'Dados inválidos.';
      throw new Error(msg);
    }

    if (resp.status === 401) {
      clearState();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (resp.status === 403) {
      throw new Error('Requisição não autorizada.');
    }

    // 500 / outros
    clearState();
    throw new Error('Erro no servidor ao alterar a senha. Entre novamente.');
  }

  function requiresPasswordChange() {
    return Boolean(mustChangePassword);
  }

  // Enviar uma ficha ao backend usando o csrfToken em memória.
  // Retorna um objeto com { status, body } em caso de resposta do servidor,
  // ou lança/retorna um objeto { networkError: true, message } em caso de falha de rede.
  async function createFicha(payload, idempotencyKey) {
    if (typeof csrfToken !== 'string' || csrfToken.length === 0) {
      throw new Error('Sessão inválida. Recarregue a página e entre novamente.');
    }
    if (!payload || typeof payload !== 'object') throw new Error('Payload inválido.');
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) throw new Error('Idempotency-Key inválida.');

    let resp;
    try {
      resp = await fetch('/cadastro/api/fichas/create.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return { networkError: true, message: (e && e.message) ? String(e.message) : 'Falha de rede.' };
    }

    const body = await safeParseJson(resp);
    return { status: resp.status, body };
  }

  // Expor apenas a API pública pedida
  return Object.freeze({
    getCurrentUser,
    isAuthenticated,
    login,
    logout,
    changePassword,
    requiresPasswordChange,
    createFicha
  });
})();
