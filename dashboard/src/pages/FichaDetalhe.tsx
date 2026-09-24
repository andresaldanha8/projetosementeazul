import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import painelApi, { mapSituacao, type FichaDetalheApi, type SituacaoApi, type AtualizacaoDadosInput, type InteresseFichaApi } from '../services/painelApi';
import { BadgeSituacao } from '../components/BadgeSituacao';
import { FichaDadosEditor, criarRascunhoDados, prepararDados, validarRascunhoDados } from '../components/FichaDadosEditor';

interface FichaDetalheProps {
  fichaId: string;
  csrfToken: string | null;
  onVoltar: () => void;
}

type Secao = 'crianca' | 'responsavel' | 'necessidades' | 'autorizacao' | 'administrativo';

interface AdministrativoDraft {
  fichaId: string;
  expectedUpdatedAt: string;
  situacao: SituacaoApi;
  dataIngresso: string;
  observacoesAdministrativas: string;
}

function saveErrorMessage(error: unknown): string {
  switch (error instanceof Error ? error.name : '') {
    case 'AuthError': return 'Sessão inválida/expirada ou acesso não autorizado.';
    case 'ConflictError': return 'Esta ficha foi atualizada por outro usuário. Recarregue os dados antes de salvar novamente.';
    case 'ValidationError': return 'Não foi possível salvar. Verifique os dados informados.';
    case 'PayloadTooLargeError': return 'Observações muito extensas.';
    case 'NotFoundError': return 'Ficha não encontrada.';
    default: return 'Não foi possível salvar as alterações.';
  }
}

function SectionTab({ id, label, ativa, onClick }: { id: Secao; label: string; ativa: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
        ativa
          ? 'border-[#1a4b8c] text-[#1a4b8c]'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-6">
      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider sm:w-44 flex-shrink-0 py-0.5">{label}</dt>
      <dd className={`text-sm text-slate-700 ${mono ? 'font-mono-data text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function TipoEventoIcon({ tipo }: { tipo: string }) {
  if (tipo === 'Criação') return (
    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </div>
  );
  if (tipo === 'Alteração de situação') return (
    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    </div>
  );
  if (tipo === 'Observação') return (
    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </div>
  );
  return (
    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </div>
  );
}

const camposLabels = new Map<string, string>([
  ['child.name', 'Nome da criança'], ['child.birthDate', 'Data de nascimento'],
  ['child.socialName', 'Nome social'], ['child.sex', 'Sexo'], ['child.rg', 'RG'],
  ['child.cpf', 'CPF da criança'], ['child.neighborhood', 'Bairro'],
  ['child.phone', 'Telefone da criança'], ['child.school', 'Escola/Instituição'],
  ['child.hasDiagnosis', 'Possui diagnóstico'], ['schooling.year', 'Ano escolar'],
  ['schooling.grade', 'Série escolar'], ['guardian.name', 'Nome do responsável'],
  ['guardian.relationship', 'Parentesco'], ['guardian.birthDate', 'Nascimento do responsável'],
  ['guardian.phone', 'Telefone do responsável'], ['guardian.whatsapp', 'WhatsApp do responsável'],
  ['guardian.email', 'E-mail do responsável'], ['interests', 'Interesses'],
  ['specificNeeds', 'Necessidades específicas'], ['consent', 'Autorização do responsável'],
  ['otherInterestDescription', 'Descrição de outro interesse'],
  ['administrativo.situacao', 'Situação'],
  ['administrativo.dataIngresso', 'Data de ingresso'],
  ['administrativo.observacoesAdministrativas', 'Observações administrativas'],
]);
const operacoes = new Map<string, string>([
  ['CRIACAO', 'Criação'], ['ALTERACAO', 'Alteração de dados'],
  ['ALTERACAO_STATUS', 'Alteração de situação'], ['ALTERACAO_OBSERVACOES', 'Observação'],
]);
const sexos = new Map<string, string>([
  ['FEMININO', 'Feminino'], ['MASCULINO', 'Masculino'], ['OUTRO', 'Outro'],
]);

function texto(value: string | null): string {
  return value === null || value.trim() === '' ? '—' : value;
}

function parseData(value: string | null): { ano: number; mes: number; dia: number } | null {
  if (value === null || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [ano, mes, dia] = value.split('-').map(Number);
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > dias[mes - 1]) return null;
  return { ano, mes, dia };
}

function formatData(value: string | null): string {
  if (!parseData(value) || value === null) return '—';
  return value.slice(8, 10) + '/' + value.slice(5, 7) + '/' + value.slice(0, 4);
}

function formatTimestamp(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?$/.exec(value);
  if (!match || match[0] !== value || !parseData(match[1]) || Number(match[2]) > 23
    || Number(match[3]) > 59 || Number(match[4]) > 59) return '—';
  return formatData(match[1]) + ' às ' + match[2] + ':' + match[3];
}

function calcularIdade(value: string): number | null {
  const nascimento = parseData(value);
  if (!nascimento) return null;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const dia = hoje.getDate();
  if (nascimento.ano > ano || (nascimento.ano === ano
    && (nascimento.mes > mes || (nascimento.mes === mes && nascimento.dia > dia)))) return null;
  return ano - nascimento.ano - (mes < nascimento.mes || (mes === nascimento.mes && dia < nascimento.dia) ? 1 : 0);
}

export function FichaDetalhe({ fichaId, csrfToken, onVoltar }: FichaDetalheProps) {
  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('crianca');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaDetalheApi | null>(null);
  const [requestId, setRequestId] = useState(fichaId);
  const [draft, setDraft] = useState<AdministrativoDraft | null>(null);
  const [dadosDraft, setDadosDraft] = useState<AtualizacaoDadosInput | null>(null);
  const [catalogo, setCatalogo] = useState<InteresseFichaApi[] | null>(null);
  const [catalogoLoading, setCatalogoLoading] = useState(false);
  const [catalogoError, setCatalogoError] = useState<string | null>(null);
  const [dadosErrors, setDadosErrors] = useState<string[]>([]);
  const [dadosFeedback, setDadosFeedback] = useState<string | null>(null);
  const dadosScope = useRef({ editing: false, request: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const operationScope = useRef({ id: fichaId, active: false, busy: false, conflict: false });

  // Invalidar operações no commit da troca de ficha, antes dos efeitos passivos.
  useLayoutEffect(() => {
    const scope = { id: fichaId, active: true, busy: false, conflict: false };
    operationScope.current = scope;
    dadosScope.current.editing = false;
    dadosScope.current.request++;
    return () => { scope.active = false; dadosScope.current.request++; };
  }, [fichaId]);

  useEffect(() => {
    let active = true;
    setRequestId(fichaId);
    setFicha(null);
    setError(null);
    setLoading(true);
    setDraft(null);
    setDadosDraft(null);
    setCatalogo(null);
    setCatalogoLoading(false);
    setCatalogoError(null);
    setDadosErrors([]);
    setDadosFeedback(null);
    setSaveError(null);
    setReloadError(null);
    setHasConflict(false);
    setIsSaving(false);
    setIsReloading(false);
    painelApi.getFicha(fichaId)
      .then(result => { if (active) setFicha(result); })
      .catch((err: unknown) => {
        if (!active) return;
        const name = err instanceof Error ? err.name : '';
        setError(name === 'AuthError'
          ? 'Sessão inválida/expirada ou acesso não autorizado.'
          : name === 'NotFoundError'
            ? 'Ficha não encontrada.'
            : 'Não foi possível carregar a ficha.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fichaId]);

  function iniciarEdicao() {
    const scope = operationScope.current;
    if (!ficha || loading || requestId !== fichaId || !scope.active || scope.busy || scope.conflict
      || dadosScope.current.editing || scope.id !== fichaId) return;
    setDadosFeedback(null);
    scope.conflict = false;
    setHasConflict(false);
    setSaveError(null);
    setReloadError(null);
    setDraft({
      fichaId: String(ficha.id),
      expectedUpdatedAt: ficha.administrativo.updatedAt,
      situacao: ficha.administrativo.situacao,
      dataIngresso: ficha.administrativo.dataIngresso ?? '',
      observacoesAdministrativas: ficha.administrativo.observacoesAdministrativas ?? '',
    });
  }

  function cancelarEdicao() {
    const scope = operationScope.current;
    if (scope.busy) return;
    setDraft(null);
    setSaveError(null);
    setReloadError(null);
    // Conflito permanece até recarregar: cancelar não torna a ficha antiga atual.
  }

  async function salvar() {
    const scope = operationScope.current;
    if (!draft || !ficha || !scope.active || scope.busy || scope.conflict || dadosScope.current.editing
      || scope.id !== fichaId || requestId !== fichaId || draft.fichaId !== String(ficha.id)
      || Number(draft.fichaId) !== Number(fichaId)) return;
    if (!csrfToken || csrfToken.trim() === '') {
      setSaveError('Sessão inválida/expirada ou acesso não autorizado.');
      return;
    }
    scope.busy = true;
    setIsSaving(true);
    setSaveError(null);
    const current = () => scope.active && operationScope.current === scope;
    try {
      const response = await painelApi.atualizarAdministrativo(draft.fichaId, {
        expectedUpdatedAt: draft.expectedUpdatedAt,
        situacao: draft.situacao,
        dataIngresso: draft.dataIngresso === '' ? null : draft.dataIngresso,
        observacoesAdministrativas: draft.observacoesAdministrativas,
      }, csrfToken);
      if (!current()) return;
      setFicha(response.ficha);
      setDraft(null);
      setSaveError(null);
      setReloadError(null);
      setHasConflict(false);
      scope.conflict = false;
    } catch (err: unknown) {
      if (!current()) return;
      if (err instanceof Error && err.name === 'ConflictError') {
        scope.conflict = true;
        setHasConflict(true);
      }
      setSaveError(saveErrorMessage(err));
    } finally {
      if (current()) {
        scope.busy = false;
        setIsSaving(false);
      }
    }
  }

  async function carregarCatalogo() {
    const scope = operationScope.current;
    if (!scope.active || !dadosScope.current.editing || scope.busy || scope.conflict) return;
    const request = ++dadosScope.current.request;
    setCatalogoLoading(true);
    setCatalogoError(null);
    const current = () => scope.active && operationScope.current === scope
      && dadosScope.current.editing && dadosScope.current.request === request;
    try {
      const options = await painelApi.getInteresses();
      if (current()) setCatalogo(options);
    } catch (err: unknown) {
      if (current()) setCatalogoError(err instanceof Error && err.name === 'AuthError'
        ? 'Sessão inválida/expirada ou acesso não autorizado.'
        : 'Não foi possível carregar o catálogo. Tente novamente antes de salvar.');
    } finally {
      if (current()) setCatalogoLoading(false);
    }
  }

  function iniciarEdicaoDados() {
    const scope = operationScope.current;
    if (!ficha || loading || requestId !== fichaId || !scope.active || scope.busy || scope.conflict
      || scope.id !== fichaId || dadosScope.current.editing) return;
    dadosScope.current.editing = true;
    setDraft(null); // Descartar edição administrativa, sem POST.
    setSaveError(null);
    setReloadError(null);
    setDadosErrors([]);
    setDadosFeedback(null);
    setCatalogo(null);
    setDadosDraft(criarRascunhoDados(ficha));
    setSecaoAtiva('crianca');
    void carregarCatalogo();
  }

  function cancelarEdicaoDados() {
    if (operationScope.current.busy) return;
    dadosScope.current.editing = false;
    dadosScope.current.request++; // Ignorar respostas de catálogo desta edição.
    setDadosDraft(null);
    setDadosErrors([]);
    setCatalogo(null);
    setCatalogoLoading(false);
    setCatalogoError(null);
    // Um conflito só é liberado após recarregar a ficha.
  }

  async function salvarDados() {
    const scope = operationScope.current;
    if (!dadosDraft || !ficha || !dadosScope.current.editing || !scope.active || scope.busy
      || scope.conflict || scope.id !== fichaId || requestId !== fichaId
      || String(ficha.id) !== String(Number(fichaId)) || catalogo === null || catalogoLoading) return;
    const errors = validarRascunhoDados(dadosDraft);
    if (errors.length) { setDadosErrors(errors); return; }
    if (!csrfToken?.trim()) { setDadosErrors(['Sessão inválida/expirada ou acesso não autorizado.']); return; }
    scope.busy = true;
    setIsSaving(true);
    setDadosErrors([]);
    const current = () => scope.active && operationScope.current === scope;
    try {
      const response = await painelApi.atualizarDados(String(ficha.id), prepararDados(dadosDraft), csrfToken);
      if (!current()) return;
      setFicha(response.ficha);
      setDadosDraft(null);
      dadosScope.current.editing = false;
      dadosScope.current.request++;
      setCatalogo(null);
      setDadosFeedback(response.alterado ? 'Alterações da ficha salvas.' : 'Nenhuma alteração foi necessária.');
    } catch (err: unknown) {
      if (!current()) return;
      if (err instanceof Error && err.name === 'ConflictError') {
        scope.conflict = true;
        setHasConflict(true);
      } else if (err instanceof Error && err.name === 'ValidationError') {
        let message = err.message === 'ValidationError' ? 'Verifique os dados informados.' : err.message;
        for (const [field, label] of camposLabels) message = message.split(field).join(label);
        setDadosErrors([message]);
      } else {
        setDadosErrors([err instanceof Error && err.name === 'PayloadTooLargeError'
          ? 'Os dados da ficha excedem o tamanho permitido.' : saveErrorMessage(err)]);
      }
    } finally {
      if (current()) { scope.busy = false; setIsSaving(false); }
    }
  }

  async function recarregarFicha() {
    const scope = operationScope.current;
    if (!scope.active || scope.busy || !scope.conflict || scope.id !== fichaId) return;
    scope.busy = true;
    setIsReloading(true);
    setReloadError(null);
    const current = () => scope.active && operationScope.current === scope;
    try {
      const atual = await painelApi.getFicha(fichaId);
      if (!current()) return;
      setFicha(atual);
      setDraft(null);
      setDadosDraft(null);
      dadosScope.current.editing = false;
      dadosScope.current.request++;
      setDadosErrors([]);
      setCatalogo(null);
      setCatalogoError(null);
      setCatalogoLoading(false);
      setSaveError(null);
      setHasConflict(false);
      scope.conflict = false;
    } catch (err: unknown) {
      if (!current()) return;
      const name = err instanceof Error ? err.name : '';
      setReloadError(name === 'AuthError' ? 'Sessão inválida/expirada ou acesso não autorizado.'
        : name === 'NotFoundError' ? 'Ficha não encontrada.' : 'Não foi possível recarregar a ficha.');
    } finally {
      if (current()) {
        scope.busy = false;
        setIsReloading(false);
      }
    }
  }

  const voltar = (
    <button onClick={onVoltar} disabled={isSaving || isReloading}
      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1a4b8c] transition-colors mb-4 font-medium">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Voltar às fichas
    </button>
  );

  // Guardar também o ID impede mostrar a ficha anterior antes de o efeito executar.
  if (requestId !== fichaId || loading || error || !ficha) {
    const carregando = requestId !== fichaId || loading;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {voltar}
        <div role={carregando ? 'status' : 'alert'} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-slate-500">
          {carregando ? 'Carregando ficha...' : error ?? 'Não foi possível carregar a ficha.'}
        </div>
      </div>
    );
  }

  const idade = calcularIdade(ficha.crianca.nascimento);
  const idadeLabel = idade === null ? '—' : idade + ' anos';
  const sexo = ficha.crianca.sexo === null ? '—' : sexos.get(ficha.crianca.sexo) ?? texto(ficha.crianca.sexo);
  const situacao = mapSituacao(ficha.administrativo.situacao);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        {voltar}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#1a4b8c]/10 flex items-center justify-center flex-shrink-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a4b8c" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono-data text-sm text-[#1a4b8c] bg-blue-50 px-2.5 py-0.5 rounded-md font-medium">{ficha.numero}</span>
                <BadgeSituacao situacao={situacao} full />
              </div>
              <h1 className="font-display text-xl font-bold text-slate-800 mt-1">{texto(ficha.crianca.nome)}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{idadeLabel} · {sexo} · Série: {texto(ficha.crianca.serieEscolar)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-400">Ingresso</p>
              <p className="text-sm font-semibold text-slate-700 font-mono-data">{formatData(ficha.administrativo.dataIngresso)}</p>
              <p className="text-xs text-slate-400 mt-2">Cadastrador</p>
              <p className="text-xs text-slate-600">{texto(ficha.administrativo.cadastradoPor)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 space-y-3">
          {dadosDraft === null ? <button type="button" onClick={iniciarEdicaoDados}
            disabled={isSaving || isReloading || hasConflict}
            className="rounded-lg bg-[#1a4b8c] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">Editar ficha</button>
            : <>
              <p className="text-sm font-medium text-slate-700">Editando dados cadastrais — campos com * são obrigatórios.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void salvarDados()}
                  disabled={isSaving || isReloading || hasConflict || catalogo === null || catalogoLoading}
                  className="rounded-lg bg-[#1a4b8c] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                  {isSaving ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button type="button" onClick={cancelarEdicaoDados} disabled={isSaving || isReloading}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancelar</button>
              </div>
              {catalogoLoading && <p role="status" className="text-sm text-slate-500">Carregando catálogo de interesses...</p>}
              {catalogoError && <div className="space-y-2">
                <p role="alert" className="text-sm text-red-600">{catalogoError}</p>
                <button type="button" disabled={catalogoLoading || isSaving || isReloading || hasConflict}
                  onClick={() => void carregarCatalogo()} className="text-sm text-[#1a4b8c] disabled:opacity-50">Tentar carregar catálogo novamente</button>
              </div>}
              {dadosErrors.length > 0 && <div role="alert" className="text-sm text-red-600">
                <p>Revise os campos nas abas:</p>
                <ul className="list-disc pl-5">{dadosErrors.map((message, index) => <li key={index}>{message}</li>)}</ul>
              </div>}
            </>}
          {dadosFeedback && <p role="status" className="text-sm text-emerald-700">{dadosFeedback}</p>}
          {hasConflict && secaoAtiva !== 'administrativo' && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
            <p role="alert" className="text-sm text-amber-800">A ficha foi alterada desde o início da edição. Recarregue os dados antes de salvar novamente.</p>
            <p className="text-xs text-slate-600">Recarregar descarta o rascunho. Nenhuma alteração será reenviada automaticamente.</p>
            <button type="button" disabled={isSaving || isReloading} onClick={() => void recarregarFicha()}
              className="text-sm text-[#1a4b8c] disabled:opacity-50">{isReloading ? 'Recarregando...' : 'Recarregar ficha'}</button>
            {reloadError && <p role="alert" className="text-sm text-red-600">{reloadError}</p>}
          </div>}
        </div>
        <div className="overflow-x-auto border-b border-slate-200">
          <div className="flex px-4 min-w-max">
            {([
              ['crianca', 'Criança / Adolescente'], ['responsavel', 'Responsável'],
              ['necessidades', 'Necessidades e Interesses'], ['autorizacao', 'Autorização'],
              ['administrativo', 'Uso da equipe'],
            ] as [Secao, string][]).map(([id, label]) => (
              <SectionTab key={id} id={id} label={label} ativa={secaoAtiva === id} onClick={() => setSecaoAtiva(id)} />
            ))}
          </div>
        </div>
        <div className="p-6">
          {dadosDraft !== null && ['crianca', 'responsavel', 'necessidades'].includes(secaoAtiva) && (
            <FichaDadosEditor secao={secaoAtiva} draft={dadosDraft} onChange={setDadosDraft}
              catalogo={catalogo} associados={ficha.necessidades.interesses} disabled={isSaving || isReloading || hasConflict} />
          )}
          {secaoAtiva === 'crianca' && dadosDraft === null && (
            <dl className="space-y-4">
              <InfoRow label="Nome completo" value={texto(ficha.crianca.nome)} />
              <InfoRow label="Nome social" value={texto(ficha.crianca.nomeSocial)} />
              <InfoRow label="Data de nascimento" value={formatData(ficha.crianca.nascimento)} />
              <InfoRow label="Idade" value={idadeLabel} />
              <InfoRow label="Sexo" value={sexo} />
              <InfoRow label="RG" value={texto(ficha.crianca.rg)} mono />
              <InfoRow label="CPF" value={texto(ficha.crianca.cpf)} mono />
              <InfoRow label="Bairro" value={texto(ficha.crianca.bairro)} />
              <InfoRow label="Telefone" value={texto(ficha.crianca.telefone)} />
              <InfoRow label="Escola/Instituição" value={texto(ficha.crianca.escola)} />
              <InfoRow label="Ano escolar" value={texto(ficha.crianca.anoEscolar)} />
              <InfoRow label="Série escolar" value={texto(ficha.crianca.serieEscolar)} />
            </dl>
          )}
          {secaoAtiva === 'responsavel' && dadosDraft === null && (
            <dl className="space-y-4">
              <InfoRow label="Nome" value={texto(ficha.responsavel.nome)} />
              <InfoRow label="Parentesco" value={texto(ficha.responsavel.parentesco)} />
              <InfoRow label="Nascimento" value={formatData(ficha.responsavel.nascimento)} />
              <InfoRow label="Telefone" value={texto(ficha.responsavel.telefone)} />
              <InfoRow label="WhatsApp" value={texto(ficha.responsavel.whatsapp)} />
              <InfoRow label="E-mail" value={texto(ficha.responsavel.email)} />
            </dl>
          )}
          {secaoAtiva === 'necessidades' && dadosDraft === null && (
            <dl className="space-y-4">
              <InfoRow label="Possui diagnóstico?" value={ficha.necessidades.possuiDiagnostico === null ? 'Não informado' : ficha.necessidades.possuiDiagnostico ? 'Sim' : 'Não'} />
              <InfoRow label="Necessidades específicas" value={texto(ficha.necessidades.necessidadesEspecificas)} />
              <InfoRow label="Interesses" value={ficha.necessidades.interesses.length ? (
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {ficha.necessidades.interesses.map((interesse, index) => (
                    <span key={interesse.codigo + ':' + index} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{interesse.nome}</span>
                  ))}
                </div>
              ) : 'Nenhum interesse registrado.'} />
              <InfoRow label="Outro interesse" value={texto(ficha.necessidades.outroInteresseDescricao)} />
            </dl>
          )}
          {secaoAtiva === 'autorizacao' && dadosDraft !== null && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3 mb-4">
            A autorização registrada é histórica e não será alterada por esta edição.
          </p>}
          {secaoAtiva === 'autorizacao' && (ficha.autorizacao === null
            ? <p className="text-sm text-slate-500">Nenhuma autorização registrada.</p>
            : (
              <dl className="space-y-4">
                <InfoRow label="Responsável que autorizou" value={texto(ficha.autorizacao.responsavelNomeSnapshot)} />
                <InfoRow label="Concordância" value={<span className={ficha.autorizacao.concordou ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>{ficha.autorizacao.concordou ? 'Sim' : 'Não'}</span>} />
                <InfoRow label="Data da autorização" value={formatTimestamp(ficha.autorizacao.concordouAt)} mono />
                <InfoRow label="Declaração" value={texto(ficha.autorizacao.declaracaoVersao)} />
                <InfoRow label="Registrado por" value={texto(ficha.autorizacao.registradoPorNome)} />
              </dl>
            )
          )}
          {secaoAtiva === 'administrativo' && (
            <div className="space-y-6">
              {dadosDraft !== null && <p className="text-sm text-slate-500">Conclua ou cancele a edição cadastral para editar as informações de uso da equipe.</p>}
              {draft === null && dadosDraft === null && !hasConflict && (
                <button type="button" onClick={iniciarEdicao} className="text-sm font-medium text-[#1a4b8c] border border-slate-200 rounded-lg px-4 py-2 hover:bg-blue-50">
                  Editar informações
                </button>
              )}
              {draft !== null && (
                <form onSubmit={event => { event.preventDefault(); void salvar(); }} className="space-y-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <fieldset disabled={isSaving || isReloading} className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Situação
                      <select value={draft.situacao} onChange={event => {
                        const value = event.target.value as SituacaoApi;
                        setDraft(previous => previous ? { ...previous, situacao: value } : null);
                      }} className="block mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        <option value="ATIVO">Ativo</option>
                        <option value="AGUARDANDO_DOCUMENTACAO">Aguardando documentação</option>
                        <option value="ACOMPANHAMENTO">Acompanhamento</option>
                        <option value="ENCERRADO">Encerrado</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Data de ingresso
                      <input type="date" min="1000-01-01" max="9999-12-31" value={draft.dataIngresso} onChange={event => {
                        const value = event.target.value;
                        setDraft(previous => previous ? { ...previous, dataIngresso: value } : null);
                      }} className="block mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Observações administrativas
                      <textarea rows={5} value={draft.observacoesAdministrativas} onChange={event => {
                        const value = event.target.value;
                        setDraft(previous => previous ? { ...previous, observacoesAdministrativas: value } : null);
                      }} className="block mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                    </label>
                    <div className="flex gap-3">
                      <button type="submit" disabled={isSaving || isReloading || hasConflict} className="rounded-lg bg-[#1a4b8c] text-white px-4 py-2 text-sm font-medium disabled:opacity-50">{isSaving ? 'Salvando...' : 'Salvar'}</button>
                      <button type="button" onClick={cancelarEdicao} disabled={isSaving || isReloading} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancelar</button>
                    </div>
                  </fieldset>
                </form>
              )}
              {saveError && !hasConflict && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
              {hasConflict && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p role="alert" className="text-sm text-amber-800">Esta ficha foi atualizada por outro usuário. Recarregue os dados antes de salvar novamente.</p>
                  <p className="text-xs text-slate-600">Ao carregar os dados atuais, o rascunho será descartado. Você poderá iniciar uma nova edição.</p>
                  <button type="button" disabled={isReloading || isSaving} onClick={() => void recarregarFicha()} className="text-sm font-medium text-[#1a4b8c] disabled:opacity-50">{isReloading ? 'Recarregando...' : 'Recarregar ficha'}</button>
                  {reloadError && <p role="alert" className="text-sm text-red-600">{reloadError}</p>}
                </div>
              )}
              <dl className="space-y-4">
                <InfoRow label="Situação" value={<BadgeSituacao situacao={situacao} full />} />
                <InfoRow label="Origem" value={ficha.administrativo.origem === 'EQUIPE_CADASTRADOR' ? 'Equipe de cadastro' : texto(ficha.administrativo.origem)} />
                <InfoRow label="Data de ingresso" value={formatData(ficha.administrativo.dataIngresso)} mono />
                <InfoRow label="Cadastrado por" value={texto(ficha.administrativo.cadastradoPor)} />
                <InfoRow label="Data/hora do cadastro" value={formatTimestamp(ficha.administrativo.createdAt)} mono />
                <InfoRow label="Última atualização" value={ficha.administrativo.atualizadoPor === null ? '—' : formatTimestamp(ficha.administrativo.updatedAt)} mono />
                <InfoRow label="Atualizado por" value={texto(ficha.administrativo.atualizadoPor)} />
                <div>
                  <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observações administrativas</dt>
                  <dd className="text-sm text-slate-700 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 leading-relaxed min-h-[60px] whitespace-pre-wrap">{texto(ficha.administrativo.observacoesAdministrativas)}</dd>
                </div>
              </dl>
              <div className="pt-4 border-t border-slate-200">
                <h3 className="font-display font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a4b8c" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Histórico de eventos
                </h3>
                {!ficha.historico.length && <p className="text-sm text-slate-500">Nenhum evento registrado.</p>}
                <div className="space-y-0">
                  {[...ficha.historico].reverse().map((evento, idx) => (
                    <div key={evento.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <TipoEventoIcon tipo={operacoes.get(evento.operacao) ?? ''} />
                        {idx < ficha.historico.length - 1 && <div className="w-px bg-slate-200 flex-1 my-1" />}
                      </div>
                      <div className="pb-5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-700">{operacoes.get(evento.operacao) ?? texto(evento.operacao)}</span>
                          <span className="text-[10px] text-slate-400 font-mono-data">{formatTimestamp(evento.ocorridoAt)}</span>
                        </div>
                        {evento.camposAlterados.length > 0 && (
                          <details className="text-xs text-slate-500 mt-1">
                            <summary className="cursor-pointer">Campos alterados</summary>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                              {evento.camposAlterados.map((campo, index) => <li key={index}>{camposLabels.get(campo) ?? 'Campo atualizado'}</li>)}
                            </ul>
                          </details>
                        )}
                        {(evento.situacaoAnterior !== null || evento.situacaoNova !== null) && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {evento.situacaoAnterior !== null && evento.situacaoNova !== null
                              ? <><span className="line-through">{mapSituacao(evento.situacaoAnterior)}</span>{' → '}<span className="font-medium text-slate-600">{mapSituacao(evento.situacaoNova)}</span></>
                              : evento.situacaoNova !== null
                                ? 'Nova situação: ' + mapSituacao(evento.situacaoNova)
                                : evento.situacaoAnterior !== null ? 'Situação anterior: ' + mapSituacao(evento.situacaoAnterior) : null}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">por {texto(evento.usuarioNomeSnapshot)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
