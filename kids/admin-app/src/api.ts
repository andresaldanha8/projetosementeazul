export const endpoint = '/kids/admin/api/';

export type ImageAuthorization = 'authorized' | 'not_authorized' | 'not_informed' | 'unavailable';
export type Registration = { id: number; numero_peito: number; crianca_nome: string; nascimento: string; idade_inscricao: number; faixa: string; divisao: string; responsavel_nome: string; vinculo: string; telefone: string; camisa: string; valor_centavos: number; pagamento: string; situacao: string; atualizada_em: string; imagem_autorizada?: unknown; imageAuthorization: ImageAuthorization; imagem_autorizacao_versao: string|null; imagem_autorizacao_texto: string|null; imagem_registrada_em: string|null };

export function normalizeImageAuthorization(value: unknown): ImageAuthorization {
  if (value === true || value === 1 || value === '1') return 'authorized';
  if (value === false || value === 0 || value === '0') return 'not_authorized';
  if (value === null) return 'not_informed';
  return 'unavailable';
}

export class KidsApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function kidsApi(path: string, init?: RequestInit) {
  const response = await fetch(endpoint + path, { credentials: 'same-origin', cache: 'no-store', ...init });
  const data = await response.json();
  if (!response.ok || !data.sucesso) {
    const error = new KidsApiError(data.mensagem || 'Não foi possível concluir. Atualize e tente novamente.', response.status, data.code);
    if (!['login.php', 'me.php'].includes(path) && (response.status === 401 || ['ACCESS_REVOKED', 'PASSWORD_CHANGE_REQUIRED'].includes(data.code))) {
      window.dispatchEvent(new CustomEvent('kids-admin-auth', { detail: error }));
    }
    throw error;
  }
  if (Array.isArray(data.registrations)) {
    data.registrations = data.registrations.map((row: Record<string, unknown>) => ({ ...row, imageAuthorization: normalizeImageAuthorization(row.imagem_autorizada) }));
  }
  return data;
}

export function kidsPost(path: string, csrfToken: string, body: object = {}) {
  return kidsApi(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) });
}

export type RegistrationFilters = { band: string; payment: string; search: string };

export function downloadCompletePdf(csrfToken: string): Promise<void> {
  return downloadPdf(csrfToken);
}
export function downloadFilteredPdf(csrfToken: string, filters: RegistrationFilters): Promise<void> {
  return downloadPdf(csrfToken, filters);
}
async function downloadPdf(csrfToken: string, filters?: RegistrationFilters): Promise<void> {
  const response = await fetch(endpoint + (filters ? 'export-filtered-pdf.php' : 'export-pdf.php'), {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'X-CSRF-Token': csrfToken, ...(filters ? { 'Content-Type': 'application/json' } : {}) },
    ...(filters ? { body: JSON.stringify(filters) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new KidsApiError(data.mensagem || 'Não foi possível gerar o PDF. Tente novamente.', response.status, data.code);
    if (response.status === 401 || ['ACCESS_REVOKED', 'PASSWORD_CHANGE_REQUIRED'].includes(data.code)) {
      window.dispatchEvent(new CustomEvent('kids-admin-auth', { detail: error }));
    }
    throw error;
  }
  if (!response.headers.get('Content-Type')?.startsWith('application/pdf')) throw new Error('Resposta de PDF inválida. Tente novamente.');
  const blob = await response.blob();
  if ((await blob.slice(0, 5).text()) !== '%PDF-') throw new Error('Arquivo PDF inválido. Tente novamente.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'autismo-run-kids-lista-completa.pdf';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
