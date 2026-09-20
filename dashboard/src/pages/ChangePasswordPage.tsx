import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import authApi, { SessionInfo } from '../services/authApi';

interface ChangePasswordPageProps {
  csrfToken: string | null;
  onPasswordChanged: (info: SessionInfo) => void;
}

export function ChangePasswordPage({ csrfToken, onPasswordChanged }: ChangePasswordPageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);

    if (!currentPassword || !newPassword || !confirmation) {
      setError('Preencha todos os campos.');
      return;
    }
    // PHP strlen measures UTF-8 bytes, not JavaScript string length.
    const passwordBytes = new TextEncoder().encode(newPassword).length;
    if (passwordBytes < 10 || passwordBytes > 1024) {
      setError('A nova senha deve ter entre 10 e 1024 bytes. Letras sem acento e números contam como um byte cada.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('A confirmação deve ser igual à nova senha.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('A nova senha deve ser diferente da senha atual.');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      const info = await authApi.changePassword(currentPassword, newPassword, csrfToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      onPasswordChanged(info);
    } catch (err: unknown) {
      setError(err instanceof Error && ['AuthError', 'ServerError', 'InvalidResponse'].includes(err.name)
        ? err.message
        : 'Erro ao conectar ao servidor. Tente novamente.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1a4b8c]/30 focus:border-[#1a4b8c] text-sm text-slate-700 disabled:opacity-60';
  const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5';

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <p className="text-center font-display font-bold text-slate-800 text-xl mb-6">Projeto Semente Azul</p>
        <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" aria-busy={loading}>
          <div>
            <h1 className="font-display font-bold text-slate-800 text-xl">Defina uma nova senha</h1>
            <p className="text-sm text-slate-500 mt-2">Por segurança, sua senha temporária precisa ser alterada antes de continuar.</p>
          </div>
          <div>
            <label htmlFor="current-password" className={labelClass}>Senha atual</label>
            <input id="current-password" type="password" autoComplete="current-password" required disabled={loading}
              value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="new-password" className={labelClass}>Nova senha</label>
            <input id="new-password" type="password" autoComplete="new-password" required disabled={loading}
              value={newPassword} onChange={event => setNewPassword(event.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="confirm-password" className={labelClass}>Confirmar nova senha</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required disabled={loading}
              value={confirmation} onChange={event => setConfirmation(event.target.value)} className={inputClass} />
          </div>
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#1a4b8c] hover:bg-[#123568] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? 'Alterando senha...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </main>
  );
}
