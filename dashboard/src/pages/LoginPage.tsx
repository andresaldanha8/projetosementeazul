import { useState } from 'react';
import authApi, { SessionInfo } from '../services/authApi';

interface LoginPageProps {
  onLogin: (info: SessionInfo) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const info = await authApi.login(login, password);
      onLogin(info);
    } catch (e: any) {
      if (e && e.name === 'AuthError') {
        setError(e.message || 'Login ou senha inválidos.');
      } else {
        setError('Erro ao conectar ao servidor. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#1a4b8c] flex items-center justify-center mb-4 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9s-9-4.03-9-9a9 9 0 0 1 9-9z"/>
              <path d="M12 11c-1.5-2-4-3-6-2"/>
              <path d="M12 11c1.5-2 4-3 6-2"/>
              <path d="M12 11v8"/>
            </svg>
          </div>
          <h1 className="font-display font-bold text-slate-800 text-xl tracking-tight">Projeto Semente Azul</h1>
          <p className="text-slate-500 text-sm mt-1">Sistema de Gestão de Cadastros</p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Usuário
            </label>
            <input
              type="text"
              placeholder="seu.usuario"
              value={login}
              onChange={e => setLogin(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a4b8c]/30 focus:border-[#1a4b8c] text-slate-700 placeholder:text-slate-400 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Senha
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a4b8c]/30 focus:border-[#1a4b8c] text-slate-700 placeholder:text-slate-400 transition-all"
            />
          </div>
          {error && <div className="text-rose-600 text-sm">{error}</div>}
          <button
            onClick={submit}
            disabled={loading}
            className={`w-full py-2.5 ${loading ? 'opacity-60 pointer-events-none' : 'bg-[#1a4b8c] hover:bg-[#123568]'} text-white text-sm font-semibold rounded-lg transition-colors mt-1`}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Projeto Semente Azul · Acesso restrito
        </p>
      </div>
    </div>
  );
}
