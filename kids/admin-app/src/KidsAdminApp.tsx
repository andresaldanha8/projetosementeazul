import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { KidsPage } from './KidsPage';
import { kidsApi, kidsPost, KidsApiError } from './api';

type Identity = { usuario: { nome: string } | null; csrfToken: string; mustChangePassword?: boolean };
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 bg-white';
const button = 'rounded-lg bg-[#1a4b8c] text-white px-4 py-2.5 font-semibold disabled:opacity-50';

export function KidsAdminApp() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [login, setLogin] = useState(''), [password, setPassword] = useState('');
  const [next, setNext] = useState(''), [confirmation, setConfirmation] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);

  async function refresh() {
    setError('');
    try { setIdentity(await kidsApi('me.php')); }
    catch (e) {
      if (e instanceof KidsApiError && e.status === 401) {
        try { setIdentity(await kidsApi('me.php')); return; } catch { /* show recovery below */ }
      }
      setIdentity(null); setError('Não foi possível verificar a sessão. Tente novamente.');
    }
  }
  useEffect(() => {
    refresh();
    const revoked = (event: Event) => {
      const code = (event as CustomEvent).detail?.code;
      // Unmount the list immediately on expiry or revocation.
      setIdentity(previous => code === 'PASSWORD_CHANGE_REQUIRED' && previous
        ? { ...previous, mustChangePassword: true } : null);
      if (code !== 'PASSWORD_CHANGE_REQUIRED') refresh();
    };
    window.addEventListener('kids-admin-auth', revoked);
    return () => window.removeEventListener('kids-admin-auth', revoked);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [identity?.usuario === null, identity?.mustChangePassword]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !identity) return;
    const changing = Boolean(identity.mustChangePassword);
    if (changing && next !== confirmation) { setError('A confirmação deve ser igual à nova senha.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      const data = await kidsPost(changing ? 'change-password.php' : 'login.php', identity.csrfToken,
        changing ? { currentPassword: password, newPassword: next } : { login, password });
      setIdentity(data); setPassword(''); setNext(''); setConfirmation('');
    } catch (e) { setError((e as Error).message); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function logout() {
    if (!identity || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await kidsPost('logout.php', identity.csrfToken); setIdentity(null); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { submitting.current = false; setBusy(false); }
  }
  const authenticated = Boolean(identity?.usuario);
  const changing = Boolean(identity?.mustChangePassword);
  return <div className="kids-admin min-h-screen bg-slate-100 text-slate-800">
    <style>{`.kids-admin :is(a,button,input,select):focus-visible{outline:3px solid #2563eb;outline-offset:3px}`}</style>
    <header className="bg-[#123568] text-white px-5 py-5 flex flex-wrap justify-between items-center gap-4">
      <div><p className="text-xs tracking-widest uppercase text-blue-200 mb-1">Projeto Semente Azul</p><p className="font-semibold text-lg">Autismo Run KIDS — Administração</p></div>
      {authenticated ? <div className="flex items-center gap-4 text-sm"><span>Olá, {identity?.usuario?.nome?.trim() || 'Administrador'}</span><button className="border border-blue-300 rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy} onClick={logout}>Sair</button></div>
        : <a href="/" className="text-sm underline underline-offset-4">Voltar ao site</a>}
    </header>
    {authenticated && !changing ? <main className="max-w-[1600px] mx-auto p-4 lg:p-8">{error && <p role="alert" className="text-rose-700 mb-4">{error}</p>}<KidsPage csrfToken={identity?.csrfToken || null} /></main>
      : <main className="max-w-md mx-auto px-5 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold mb-3 outline-none">{changing ? 'Defina uma nova senha' : 'Entrar na área KIDS'}</h1>
          <p className="text-sm text-slate-500 mb-6">{changing ? 'Troque a senha temporária antes de acessar as inscrições. Esta senha é exclusiva da administração KIDS.' : 'Acesso exclusivo a administradores autorizados da corrida.'}</p>
          {identity ? <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
            {!changing && <div><label htmlFor="kids-login" className="block text-sm font-semibold mb-2">Usuário</label><input id="kids-login" className={input} autoComplete="username" required maxLength={100} disabled={busy} value={login} onChange={e => setLogin(e.target.value)} /></div>}
            <div><label htmlFor="kids-password" className="block text-sm font-semibold mb-2">{changing ? 'Senha atual' : 'Senha'}</label><input id="kids-password" className={input} type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} /></div>
            {changing && <><div><label htmlFor="kids-new-password" className="block text-sm font-semibold mb-2">Nova senha</label><input id="kids-new-password" className={input} type="password" autoComplete="new-password" required disabled={busy} value={next} onChange={e => setNext(e.target.value)} /><p className="text-xs text-slate-500 mt-1">Entre 10 e 72 bytes.</p></div><div><label htmlFor="kids-confirm-password" className="block text-sm font-semibold mb-2">Confirmar nova senha</label><input id="kids-confirm-password" className={input} type="password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div></>}
            {error && <p role="alert" className="text-rose-700 text-sm">{error}</p>}
            <button type="submit" className={button + ' w-full'} disabled={busy}>{busy ? 'Aguarde…' : changing ? 'Alterar senha' : 'Entrar'}</button>
          </form> : <><p role="status" className="text-sm">{error || 'Verificando sessão…'}</p>{error && <button className={button + ' mt-4'} onClick={refresh}>Tentar novamente</button>}</>}
        </div>
      </main>}
  </div>;
}
