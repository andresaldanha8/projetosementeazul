import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import painelApi, { type UsuarioListApi } from '../services/painelApi';

function formatarCadastro(value: string): string {
  // Preserva a data SQL, sem deslocamento pelo fuso do navegador.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/.exec(value);
  if (!match) return '—';
  const [, ano, mes, dia] = match;
  const ymd = ano + '-' + mes + '-' + dia;
  const date = new Date(ymd + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== ymd) return '—';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function erroCriacao(err: unknown): string {
  switch (err instanceof Error ? err.name : '') {
    case 'ConflictError': return 'Este usuário já está cadastrado.';
    case 'ValidationError': return 'Dados inválidos. Confira os campos informados.';
    case 'SessionExpiredError': return 'Sessão inválida ou expirada. Recarregue a página para entrar novamente.';
    case 'ForbiddenError': return 'Sem autorização para criar usuários ou sessão em condição incompatível. Recarregue a página.';
    case 'PayloadTooLargeError': return 'Os dados enviados excedem o tamanho permitido.';
    case 'UnsupportedMediaTypeError': return 'Formato de envio não aceito pelo servidor.';
    case 'InvalidResponse': return 'Não foi possível confirmar a resposta. Confira a listagem antes de tentar criar novamente.';
    default: return 'Não foi possível confirmar a criação. Confira a listagem antes de tentar novamente.';
  }
}

function NovoUsuarioModal({ csrfToken, onClose, onCreated }: {
  csrfToken: string | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    element?.showModal();
    return () => { mounted.current = false; element?.close(); };
  }, []);

  const fechar = () => {
    if (busy.current) return;
    setSenha('');
    setConfirmacao('');
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    setError(null);
    const nomeLimpo = nome.trim();
    const loginLimpo = login.trim();
    if (!nomeLimpo || !loginLimpo || !senha || !confirmacao) {
      setError('Preencha todos os campos.');
      return;
    }
    if (Array.from(nomeLimpo).length > 200 || Array.from(loginLimpo).length > 100) {
      setError('Nome deve ter até 200 caracteres e usuário até 100 caracteres.');
      return;
    }
    if (new TextEncoder().encode(senha).length < 10) {
      setError('A senha temporária deve ter pelo menos 10 bytes UTF-8. Letras sem acento e números contam como um byte cada.');
      return;
    }
    if (senha !== confirmacao) {
      setError('A confirmação deve ser igual à senha temporária.');
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      const response = await painelApi.criarUsuario({ nome: nomeLimpo, login: loginLimpo, senhaTemporaria: senha }, csrfToken);
      if (!mounted.current) return;
      setNome('');
      setLogin('');
      setSenha('');
      setConfirmacao('');
      onCreated(response.usuario.id);
    } catch (err: unknown) {
      if (mounted.current) setError(erroCriacao(err));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a4b8c]/30 focus:border-[#1a4b8c]';
  return (
    <dialog ref={dialog} aria-labelledby="novo-usuario-titulo" onCancel={event => { event.preventDefault(); fechar(); }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/40">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 id="novo-usuario-titulo" className="font-display text-xl font-bold text-slate-800">Novo usuário</h2>
        <button type="button" onClick={fechar} disabled={saving} aria-label="Fechar formulário" className="rounded-lg px-3 py-2 text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Fechar</button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Crie um cadastrador. Comunique a senha temporária ao novo usuário; ele deverá alterá-la no primeiro acesso.</p>
      <form onSubmit={submit} aria-busy={saving}>
        <fieldset disabled={saving} className="space-y-4">
          <div>
            <label htmlFor="novo-nome" className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input id="novo-nome" autoFocus autoComplete="off" required value={nome} onChange={e => setNome(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="novo-login" className="block text-sm font-medium text-slate-700 mb-1">Usuário</label>
            <input id="novo-login" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={login} onChange={e => setLogin(e.target.value)} aria-describedby="novo-login-ajuda" className={inputClass} />
            <p id="novo-login-ajuda" className="text-xs text-slate-500 mt-1">Utilizado para login. O sistema salva o usuário em letras minúsculas.</p>
          </div>
          <div>
            <label htmlFor="nova-senha-temporaria" className="block text-sm font-medium text-slate-700 mb-1">Senha temporária</label>
            <input id="nova-senha-temporaria" type="password" autoComplete="new-password" required value={senha} onChange={e => setSenha(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="nova-confirmacao" className="block text-sm font-medium text-slate-700 mb-1">Confirmar senha</label>
            <input id="nova-confirmacao" type="password" autoComplete="new-password" required value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className={inputClass} />
          </div>
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={fechar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-600">Cancelar</button>
            <button type="submit" className="rounded-lg bg-[#1a4b8c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123568] focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50" disabled={saving}>{saving ? 'Criando...' : 'Criar cadastrador'}</button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}

export function UsuariosPage({ csrfToken }: { csrfToken: string | null }) {
  const [usuarios, setUsuarios] = useState<UsuarioListApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    painelApi.getUsuarios()
      .then(response => {
        if (cancelled) return;
        setUsuarios(response.usuarios);
        if (createdId !== null && !response.usuarios.some(usuario => usuario.id === createdId)) {
          setSuccess('Cadastrador criado com sucesso. Ele não consta no recorte de até 100 usuários retornado pela listagem.');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setUsuarios([]);
        setError(err instanceof Error && err.name === 'AuthError'
          ? 'Sua sessão expirou ou você não tem permissão para consultar usuários.'
          : 'Não foi possível carregar os usuários. Tente recarregar a página.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [createdId]);

  const badgeClass = 'inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap';

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Usuários</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie os acessos ao sistema</p>
        </div>
        <button type="button" onClick={() => { setSuccess(null); setModalAberto(true); }} className="rounded-lg bg-[#1a4b8c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123568] focus-visible:ring-2 focus-visible:ring-blue-600">Novo usuário</button>
      </div>
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
      {modalAberto && <NovoUsuarioModal csrfToken={csrfToken} onClose={() => setModalAberto(false)} onCreated={id => {
        setModalAberto(false);
        setSuccess('Cadastrador criado com sucesso.');
        setLoading(true);
        setCreatedId(id);
      }} />}
      <div className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <p role="status" className="py-20 px-6 text-center text-slate-500 font-medium">Carregando usuários...</p>
        ) : error ? (
          <p role="alert" className="py-20 px-6 text-center text-slate-500 font-medium">{error}</p>
        ) : usuarios.length === 0 ? (
          <p role="status" className="py-20 px-6 text-center text-slate-500 font-medium">Nenhum usuário encontrado.</p>
        ) : (
          <div className="max-w-full overflow-x-auto" role="region" aria-label="Listagem de usuários" tabIndex={0}>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-200">
                  {['Nome', 'Usuário', 'Perfil', 'Status', 'Troca de senha', 'Cadastro'].map(titulo => (
                    <th key={titulo} scope="col" className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{titulo}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map(usuario => (
                  <tr key={usuario.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-4 font-semibold text-slate-800 break-words [overflow-wrap:anywhere] max-w-xs">{usuario.nome}</td>
                    <td className="px-4 py-4 text-slate-600 break-words [overflow-wrap:anywhere] max-w-xs">{usuario.login}</td>
                    <td className="px-4 py-4">
                      <span className={badgeClass + (usuario.perfil === 'ADMINISTRADOR' ? ' bg-blue-50 text-blue-700' : ' bg-slate-100 text-slate-600')}>
                        {usuario.perfil === 'ADMINISTRADOR' ? 'Administrador' : 'Cadastrador'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={badgeClass + (usuario.ativo ? ' bg-emerald-50 text-emerald-700' : ' bg-slate-100 text-slate-600')}>
                        {usuario.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={badgeClass + (usuario.mustChangePassword ? ' bg-amber-50 text-amber-700' : ' bg-emerald-50 text-emerald-700')}>
                        {usuario.mustChangePassword ? 'Pendente' : 'Concluída'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 whitespace-nowrap">{formatarCadastro(usuario.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
