export type Perfil = 'ADMINISTRADOR' | 'CADASTRADOR';

export interface SessionUser {
  id: number;
  nome: string;
  perfil: Perfil;
}

export interface SessionInfo {
  user: SessionUser;
  csrfToken: string | null;
  mustChangePassword: boolean;
}

async function safeParseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionInfo> {
  const res = await fetch('/cadastro/api/auth/me.php', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 401) {
    const err: any = new Error('Not authenticated');
    err.name = 'AuthError';
    throw err;
  }

  if (res.status === 403) {
    const err: any = new Error('Forbidden');
    err.name = 'AuthError';
    throw err;
  }

  if (!res.ok) {
    const err: any = new Error('ServerError');
    err.name = 'ServerError';
    throw err;
  }

  const data = await safeParseJson(res);
  if (!data || typeof data !== 'object' || data.sucesso !== true || typeof data.usuario !== 'object') {
    const err: any = new Error('InvalidResponse');
    err.name = 'InvalidResponse';
    throw err;
  }

  const u = data.usuario;
  if (typeof u.id !== 'number' || typeof u.nome !== 'string' || typeof u.perfil !== 'string') {
    const err: any = new Error('InvalidResponse');
    err.name = 'InvalidResponse';
    throw err;
  }

  // Validate perfil strictly
  if (u.perfil !== 'ADMINISTRADOR' && u.perfil !== 'CADASTRADOR') {
    const err: any = new Error('InvalidPerfil');
    err.name = 'InvalidResponse';
    throw err;
  }

  const csrf = (data.csrfToken && typeof data.csrfToken === 'string') ? data.csrfToken : null;
  const mustChange = Boolean(data.mustChangePassword === 1 || data.mustChangePassword === true);

  return {
    user: {
      id: u.id,
      nome: u.nome,
      perfil: u.perfil,
    } as SessionUser,
    csrfToken: csrf,
    mustChangePassword: mustChange,
  } as SessionInfo;
}

export async function login(login: string, password: string): Promise<SessionInfo> {
  if (typeof login !== 'string' || typeof password !== 'string') {
    const err: any = new Error('Invalid credentials');
    err.name = 'AuthError';
    throw err;
  }

  const res = await fetch('/cadastro/api/auth/login.php', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ login, password }),
  });

  const data = await safeParseJson(res);

  if (res.status === 200) {
    if (!data || typeof data !== 'object' || data.sucesso !== true || typeof data.usuario !== 'object') {
      const err: any = new Error('InvalidResponse');
      err.name = 'InvalidResponse';
      throw err;
    }
    const u = data.usuario;
    if (typeof u.id !== 'number' || typeof u.nome !== 'string' || typeof u.perfil !== 'string') {
      const err: any = new Error('InvalidResponse');
      err.name = 'InvalidResponse';
      throw err;
    }
    if (u.perfil !== 'ADMINISTRADOR' && u.perfil !== 'CADASTRADOR') {
      const err: any = new Error('InvalidPerfil');
      err.name = 'InvalidResponse';
      throw err;
    }

    const csrf = (data.csrfToken && typeof data.csrfToken === 'string') ? data.csrfToken : null;
    const mustChange = Boolean(data.mustChangePassword === 1 || data.mustChangePassword === true);

    return {
      user: {
        id: u.id,
        nome: u.nome,
        perfil: u.perfil,
      },
      csrfToken: csrf,
      mustChangePassword: mustChange,
    } as SessionInfo;
  }

  // 400/401/known client errors
  if (res.status === 400 || res.status === 401) {
    const msg = (data && (data.mensagem || data.message)) ? String(data.mensagem || data.message) : 'Login or password invalid.';
    const err: any = new Error(msg);
    err.name = 'AuthError';
    throw err;
  }

  const err: any = new Error('ServerError');
  err.name = 'ServerError';
  throw err;
}

export async function logout(csrfToken?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (csrfToken && typeof csrfToken === 'string') headers['X-CSRF-Token'] = csrfToken;

  const res = await fetch('/cadastro/api/auth/logout.php', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
  });

  if (res.status === 200) return;

  if (res.status === 401) return; // already unauthenticated on server

  if (res.status === 403) {
    const err: any = new Error('Requisição não autorizada.');
    err.name = 'AuthError';
    throw err;
  }

  const err: any = new Error('ServerError');
  err.name = 'ServerError';
  throw err;
}

export default { getCurrentUser, login, logout };
