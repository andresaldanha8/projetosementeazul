export type SituacaoApi = 'ATIVO' | 'AGUARDANDO_DOCUMENTACAO' | 'ACOMPANHAMENTO' | 'ENCERRADO';

export type Situacao = 'Ativo' | 'Aguardando documentação' | 'Acompanhamento' | 'Encerrado';

export interface IndicadoresApi {
  total: number;
  ativos: number;
  aguardandoDocumentacao: number;
  acompanhamento: number;
}

export interface IndicadoresFront {
  total: number;
  ativos: number;
  aguardando: number;
  acompanhamento: number;
}

export interface FichaApi {
  id: number;
  numero: string;
  criancaNome: string;
  responsavelNome: string;
  situacao: SituacaoApi;
  createdAt: string;
  cadastradoPor: string;
}

export interface FichaListApi {
  id: number;
  numero: string;
  criancaNome: string;
  criancaNascimento: string | null;
  criancaSexo: 'FEMININO' | 'MASCULINO' | 'OUTRO' | null;
  responsavelNome: string | null;
  responsavelParentesco: string | null;
  situacao: SituacaoApi;
  createdAt: string;
  cadastradoPor: string | null;
}

export interface FichasListResponse {
  sucesso: true;
  total: number;
  page: number;
  perPage: number;
  fichas: FichaListApi[];
}

export interface FichaFront {
  id: string;
  nCadastro: string;
  criancaNome: string;
  responsavelNome: string;
  situacao: Situacao;
  createdAt: string; // original value preserved
  cadastradoPor: string;
}

export function mapSituacao(api: SituacaoApi): Situacao {
  switch (api) {
    case 'ATIVO':
      return 'Ativo';
    case 'AGUARDANDO_DOCUMENTACAO':
      return 'Aguardando documentação';
    case 'ACOMPANHAMENTO':
      return 'Acompanhamento';
    case 'ENCERRADO':
      return 'Encerrado';
    default:
      // Should be exhaustive per contract; treat as invalid
      throw new Error('InvalidSituacao');
  }
}

async function fetchJson(url: string, distinguishNotFound = false) {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 401 || res.status === 403) {
    const err: any = new Error('Unauthorized');
    err.name = 'AuthError';
    throw err;
  }

  if (distinguishNotFound && res.status === 404) {
    const err = new Error('NotFoundError');
    err.name = 'NotFoundError';
    throw err;
  }

  if (!res.ok) {
    const err: any = new Error('ServerError');
    err.name = 'ServerError';
    throw err;
  }

  // ensure JSON
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    const err: any = new Error('InvalidJSON');
    err.name = 'InvalidJSON';
    throw err;
  }
}

export async function getIndicadores(): Promise<IndicadoresFront> {
  const data = await fetchJson('/cadastro/api/painel/indicadores.php');

  if (!data || typeof data !== 'object' || data.sucesso !== true || !data.indicadores) {
    const err: any = new Error('InvalidResponse');
    err.name = 'InvalidResponse';
    throw err;
  }

  const api: IndicadoresApi = data.indicadores;

  // Validate minimal structure
  if (
    typeof api.total !== 'number' ||
    typeof api.ativos !== 'number' ||
    typeof api.aguardandoDocumentacao !== 'number' ||
    typeof api.acompanhamento !== 'number'
  ) {
    const err: any = new Error('InvalidResponse');
    err.name = 'InvalidResponse';
    throw err;
  }

  return {
    total: api.total,
    ativos: api.ativos,
    aguardando: api.aguardandoDocumentacao,
    acompanhamento: api.acompanhamento,
  };
}

export async function getFichasRecentes(): Promise<FichaFront[]> {
  const data = await fetchJson('/cadastro/api/painel/fichas-recentes.php');

  if (!data || typeof data !== 'object' || data.sucesso !== true || !Array.isArray(data.fichas)) {
    const err: any = new Error('InvalidResponse');
    err.name = 'InvalidResponse';
    throw err;
  }

  const res: FichaFront[] = data.fichas.map((f: any) => {
    if (
      typeof f.id !== 'number' ||
      typeof f.numero !== 'string' ||
      typeof f.criancaNome !== 'string' ||
      typeof f.responsavelNome !== 'string' ||
      typeof f.situacao !== 'string' ||
      typeof f.createdAt !== 'string' ||
      typeof f.cadastradoPor !== 'string'
    ) {
      const err: any = new Error('InvalidResponse');
      err.name = 'InvalidResponse';
      throw err;
    }

    // map situacao strictly
    const situacao = mapSituacao(f.situacao as SituacaoApi);

    return {
      id: String(f.id),
      nCadastro: f.numero,
      criancaNome: f.criancaNome,
      responsavelNome: f.responsavelNome,
      situacao,
      createdAt: f.createdAt,
      cadastradoPor: f.cadastradoPor,
    } as FichaFront;
  });

  return res;
}

export async function getFichas(params: {
  q?: string | null;
  situacao?: SituacaoApi | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  page?: number | null;
  per_page?: number | null;
}): Promise<{ total: number; page: number; perPage: number; fichas: FichaListApi[] }> {
  const qs: string[] = [];
  if (params.q) qs.push('q=' + encodeURIComponent(String(params.q)));
  if (params.situacao) qs.push('situacao=' + encodeURIComponent(String(params.situacao)));
  if (params.data_inicio) qs.push('data_inicio=' + encodeURIComponent(String(params.data_inicio)));
  if (params.data_fim) qs.push('data_fim=' + encodeURIComponent(String(params.data_fim)));
  if (params.page) qs.push('page=' + String(params.page));
  if (params.per_page) qs.push('per_page=' + String(params.per_page));
  const url = '/cadastro/api/painel/fichas.php' + (qs.length ? '?' + qs.join('&') : '');

  const data = await fetchJson(url);

  if (!data || typeof data !== 'object' || data.sucesso !== true || !Array.isArray(data.fichas)) {
    const err: any = new Error('InvalidResponse');
    err.name = 'InvalidResponse';
    throw err;
  }

  // minimal validation of response shape
  if (typeof data.total !== 'number' || typeof data.page !== 'number' || typeof data.perPage !== 'number') {
    const err: any = new Error('InvalidResponse');
    err.name = 'InvalidResponse';
    throw err;
  }

  const items: FichaListApi[] = data.fichas.map((f: any) => {
    if (typeof f.id !== 'number' || typeof f.numero !== 'string' || typeof f.criancaNome !== 'string' || typeof f.situacao !== 'string' || typeof f.createdAt !== 'string') {
      const err: any = new Error('InvalidResponse');
      err.name = 'InvalidResponse';
      throw err;
    }

    return {
      id: f.id,
      numero: f.numero,
      criancaNome: f.criancaNome,
      criancaNascimento: f.criancaNascimento ?? null,
      criancaSexo: f.criancaSexo ?? null,
      responsavelNome: f.responsavelNome ?? null,
      responsavelParentesco: f.responsavelParentesco ?? null,
      situacao: f.situacao as SituacaoApi,
      createdAt: f.createdAt,
      cadastradoPor: f.cadastradoPor ?? null,
    };
  });

  return { total: data.total, page: data.page, perPage: data.perPage, fichas: items };
}

export interface InteresseFichaApi {
  codigo: string;
  nome: string;
}

export interface AutorizacaoFichaApi {
  responsavelNomeSnapshot: string;
  concordou: boolean;
  concordouAt: string;
  declaracaoId: number;
  declaracaoVersao: string;
  registradoPorId: number;
  registradoPorNome: string;
}

export interface HistoricoFichaApi {
  id: number;
  operacao: string;
  ocorridoAt: string;
  usuarioNomeSnapshot: string;
  camposAlterados: string[];
  situacaoAnterior: SituacaoApi | null;
  situacaoNova: SituacaoApi | null;
}

export interface FichaDetalheApi {
  id: number;
  numero: string;
  crianca: {
    nome: string;
    nomeSocial: string | null;
    nascimento: string;
    sexo: string | null;
    rg: string | null;
    cpf: string | null;
    bairro: string | null;
    telefone: string | null;
    escola: string | null;
    anoEscolar: string | null;
    serieEscolar: string | null;
  };
  responsavel: {
    nome: string;
    parentesco: string;
    nascimento: string | null;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
  necessidades: {
    possuiDiagnostico: boolean | null;
    necessidadesEspecificas: string | null;
    outroInteresseDescricao: string | null;
    interesses: InteresseFichaApi[];
  };
  autorizacao: AutorizacaoFichaApi | null;
  administrativo: {
    situacao: SituacaoApi;
    origem: string;
    dataIngresso: string | null;
    observacoesAdministrativas: string | null;
    cadastradoPor: string;
    createdAt: string;
    updatedAt: string;
    atualizadoPor: string | null;
  };
  historico: HistoricoFichaApi[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isSituacao(value: unknown): value is SituacaoApi {
  return value === 'ATIVO' || value === 'AGUARDANDO_DOCUMENTACAO'
    || value === 'ACOMPANHAMENTO' || value === 'ENCERRADO';
}

function isFichaDetalhe(value: unknown): value is FichaDetalheApi {
  if (!isRecord(value) || !isPositiveId(value.id)
    || value.numero !== `PSA-${String(value.id).padStart(6, '0')}`) return false;

  const { crianca: c, responsavel: r, necessidades: n, administrativo: a, autorizacao: consent, historico } = value;
  if (!isRecord(c) || !isRecord(r) || !isRecord(n) || !isRecord(a)) return false;
  if (typeof c.nome !== 'string' || typeof c.nascimento !== 'string'
    || !['nomeSocial', 'sexo', 'rg', 'cpf', 'bairro', 'telefone', 'escola', 'anoEscolar', 'serieEscolar']
      .every(key => isNullableString(c[key]))) return false;
  if (typeof r.nome !== 'string' || typeof r.parentesco !== 'string'
    || !['nascimento', 'telefone', 'whatsapp', 'email'].every(key => isNullableString(r[key]))) return false;
  if (!(n.possuiDiagnostico === null || typeof n.possuiDiagnostico === 'boolean')
    || !isNullableString(n.necessidadesEspecificas) || !isNullableString(n.outroInteresseDescricao)
    || !Array.isArray(n.interesses) || !n.interesses.every(i =>
      isRecord(i) && typeof i.codigo === 'string' && typeof i.nome === 'string')) return false;
  if (!isSituacao(a.situacao)
    || !['origem', 'cadastradoPor', 'createdAt', 'updatedAt'].every(key => typeof a[key] === 'string')
    || !['dataIngresso', 'observacoesAdministrativas', 'atualizadoPor'].every(key => isNullableString(a[key]))) return false;
  if (consent !== null && (!isRecord(consent)
    || typeof consent.concordou !== 'boolean'
    || !isPositiveId(consent.declaracaoId) || !isPositiveId(consent.registradoPorId)
    || !['responsavelNomeSnapshot', 'concordouAt', 'declaracaoVersao', 'registradoPorNome']
      .every(key => typeof consent[key] === 'string'))) return false;
  return Array.isArray(historico) && historico.every(event => isRecord(event)
    && isPositiveId(event.id)
    && typeof event.operacao === 'string' && typeof event.ocorridoAt === 'string'
    && typeof event.usuarioNomeSnapshot === 'string'
    && Array.isArray(event.camposAlterados) && event.camposAlterados.every(field => typeof field === 'string')
    && (event.situacaoAnterior === null || isSituacao(event.situacaoAnterior))
    && (event.situacaoNova === null || isSituacao(event.situacaoNova)));
}

export async function getFicha(id: string): Promise<FichaDetalheApi> {
  if (typeof id !== 'string' || id.length === 0 || /[^0-9]/.test(id) || !isPositiveId(Number(id))) {
    const err = new Error('InvalidId');
    err.name = 'InvalidId';
    throw err;
  }
  const data: unknown = await fetchJson('/cadastro/api/painel/ficha.php?id=' + encodeURIComponent(id), true);
  if (!isRecord(data) || data.sucesso !== true || !isFichaDetalhe(data.ficha) || data.ficha.id !== Number(id)) {
    const err = new Error('InvalidResponse');
    err.name = 'InvalidResponse';
    throw err;
  }
  return data.ficha;
}

export interface AtualizacaoAdministrativaInput {
  expectedUpdatedAt: string;
  situacao: SituacaoApi;
  dataIngresso: string | null;
  observacoesAdministrativas: string | null;
}

export interface AtualizacaoAdministrativaResponse {
  sucesso: true;
  alterado: boolean;
  ficha: FichaDetalheApi;
}

function administrativeError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function isAdministrativeDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1000 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function isAdministrativeTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 26) return false;
  const parts = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})\.\d{6}$/.exec(value);
  return parts !== null && isAdministrativeDate(parts[1])
    && Number(parts[2]) <= 23 && Number(parts[3]) <= 59 && Number(parts[4]) <= 59;
}

export async function atualizarAdministrativo(
  id: string,
  dados: AtualizacaoAdministrativaInput,
  csrfToken: string,
): Promise<AtualizacaoAdministrativaResponse> {
  if (typeof csrfToken !== 'string' || csrfToken.trim() === '') throw administrativeError('AuthError');
  if (typeof id !== 'string' || id.length === 0 || /[^0-9]/.test(id) || !isPositiveId(Number(id))) {
    throw administrativeError('ValidationError');
  }
  if (!isRecord(dados) || Object.keys(dados).length !== 4
    || !isAdministrativeTimestamp(dados.expectedUpdatedAt) || !isSituacao(dados.situacao)
    || !(dados.dataIngresso === null || isAdministrativeDate(dados.dataIngresso))
    || !isNullableString(dados.observacoesAdministrativas)) throw administrativeError('ValidationError');

  const res = await fetch('/cadastro/api/painel/ficha-administrativo.php?id=' + encodeURIComponent(id), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({
      expectedUpdatedAt: dados.expectedUpdatedAt,
      situacao: dados.situacao,
      dataIngresso: dados.dataIngresso,
      observacoesAdministrativas: dados.observacoesAdministrativas,
    }),
  });
  if (res.status !== 200) {
    switch (res.status) {
      case 400: throw administrativeError('ValidationError');
      case 401:
      case 403: throw administrativeError('AuthError');
      case 404: throw administrativeError('NotFoundError');
      case 409: throw administrativeError('ConflictError');
      case 413: throw administrativeError('PayloadTooLargeError');
      case 415: throw administrativeError('UnsupportedMediaTypeError');
      default: throw administrativeError('ServerError');
    }
  }
  const raw = await res.text();
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw administrativeError('InvalidJSON'); }
  if (!isRecord(data) || data.sucesso !== true || typeof data.alterado !== 'boolean'
    || !isFichaDetalhe(data.ficha) || data.ficha.id !== Number(id)) throw administrativeError('InvalidResponse');
  return { sucesso: true, alterado: data.alterado, ficha: data.ficha };
}

export interface UsuarioListApi {
  id: number;
  nome: string;
  login: string;
  perfil: 'ADMINISTRADOR' | 'CADASTRADOR';
  ativo: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsuariosListResponse {
  sucesso: true;
  usuarios: UsuarioListApi[];
}

export async function getUsuarios(): Promise<UsuariosListResponse> {
  const data: unknown = await fetchJson('/cadastro/api/painel/usuarios.php');
  if (!isRecord(data) || data.sucesso !== true || !Array.isArray(data.usuarios)) {
    throw administrativeError('InvalidResponse');
  }
  const usuarios = data.usuarios.map((item: unknown): UsuarioListApi => {
    if (!isRecord(item) || !isPositiveId(item.id)
      || typeof item.nome !== 'string' || typeof item.login !== 'string'
      || (item.perfil !== 'ADMINISTRADOR' && item.perfil !== 'CADASTRADOR')
      || typeof item.ativo !== 'boolean' || typeof item.mustChangePassword !== 'boolean'
      || typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string') {
      throw administrativeError('InvalidResponse');
    }
    return {
      id: item.id, nome: item.nome, login: item.login, perfil: item.perfil,
      ativo: item.ativo, mustChangePassword: item.mustChangePassword,
      createdAt: item.createdAt, updatedAt: item.updatedAt,
    };
  });
  return { sucesso: true, usuarios };
}

export interface CriarUsuarioInput {
  nome: string;
  login: string;
  senhaTemporaria: string;
}

export interface UsuarioCriadoApi {
  id: number;
  nome: string;
  login: string;
  perfil: 'CADASTRADOR';
  ativo: true;
  mustChangePassword: true;
}

export interface CriarUsuarioResponse {
  sucesso: true;
  usuario: UsuarioCriadoApi;
}

export async function criarUsuario(dados: CriarUsuarioInput, csrfToken: string | null): Promise<CriarUsuarioResponse> {
  if (!csrfToken) throw administrativeError('ForbiddenError');
  const res = await fetch('/cadastro/api/painel/usuarios-criar.php', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ nome: dados.nome, login: dados.login, senhaTemporaria: dados.senhaTemporaria }),
  });
  if (res.status !== 201) {
    switch (res.status) {
      case 400: throw administrativeError('ValidationError');
      case 401: throw administrativeError('SessionExpiredError');
      case 403: throw administrativeError('ForbiddenError');
      case 409: throw administrativeError('ConflictError');
      case 413: throw administrativeError('PayloadTooLargeError');
      case 415: throw administrativeError('UnsupportedMediaTypeError');
      default: throw administrativeError('ServerError');
    }
  }
  let data: unknown;
  try { data = await res.json(); }
  catch { throw administrativeError('InvalidResponse'); }
  if (!isRecord(data) || data.sucesso !== true || !isRecord(data.usuario)) {
    throw administrativeError('InvalidResponse');
  }
  const u = data.usuario;
  if (!isPositiveId(u.id) || typeof u.nome !== 'string' || typeof u.login !== 'string'
    || u.perfil !== 'CADASTRADOR' || u.ativo !== true || u.mustChangePassword !== true) {
    throw administrativeError('InvalidResponse');
  }
  return { sucesso: true, usuario: {
    id: u.id, nome: u.nome, login: u.login, perfil: u.perfil,
    ativo: u.ativo, mustChangePassword: u.mustChangePassword,
  } };
}

export default {
  criarUsuario,
  getUsuarios,
  getIndicadores,
  getFichasRecentes,
  getFichas,
  getFicha,
  atualizarAdministrativo,
};
