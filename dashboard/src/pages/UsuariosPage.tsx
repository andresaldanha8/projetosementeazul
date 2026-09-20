import { useEffect, useState } from 'react';
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

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioListApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    painelApi.getUsuarios()
      .then(response => {
        if (!cancelled) setUsuarios(response.usuarios);
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
  }, []);

  const badgeClass = 'inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap';

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800">Usuários</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie os acessos ao sistema</p>
      </div>
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
