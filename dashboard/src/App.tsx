import { useEffect, useState } from 'react';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { ModalConfirmaSaida } from './components/ModalConfirmaSaida';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { FichasPage } from './pages/FichasPage';
import { FichaDetalhe } from './pages/FichaDetalhe';
import { UsuariosPage } from './pages/UsuariosPage';
import authApi, { SessionUser, SessionInfo } from './services/authApi';

type Pagina = 'dashboard' | 'fichas' | 'usuarios';

export default function App() {
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking');
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [pagina, setPagina] = useState<Pagina>('dashboard');
  const [fichaAberta, setFichaAberta] = useState<string | null>(null);
  const [sidebarMobile, setSidebarMobile] = useState(false);

  const abrirFicha = (id: string) => {
    setFichaAberta(id);
    setPagina('fichas');
  };

  const voltarFichas = () => {
    setFichaAberta(null);
  };

  const navegar = (p: Pagina) => {
    setPagina(p);
    setFichaAberta(null);
    setSidebarMobile(false);
  };

  const confirmarLogout = () => {
    setConfirmarSaida(false);
    // keep logout mocked for now: mark session as unauthenticated locally
    setSessionStatus('unauthenticated');
    setPagina('dashboard');
    setFichaAberta(null);
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await authApi.logout(csrfToken ?? null);
      setCurrentUser(null);
      setCsrfToken(null);
      setMustChangePassword(false);
      setSessionStatus('unauthenticated');
      setConfirmarSaida(false);
      setPagina('dashboard');
      setFichaAberta(null);
    } catch (err: any) {
      // Do not fake logout; keep authenticated. Close modal to avoid blocking UX.
      console.error('Logout failed', err);
      setConfirmarSaida(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setSessionStatus('checking');
    authApi.getCurrentUser()
      .then(info => {
        if (!mounted) return;
        setCurrentUser(info.user);
        setCsrfToken(info.csrfToken ?? null);
        setMustChangePassword(Boolean(info.mustChangePassword));
        setSessionStatus('authenticated');
      })
      .catch((err: any) => {
        if (!mounted) return;
        if (err && err.name === 'AuthError') {
          setCurrentUser(null);
          setSessionStatus('unauthenticated');
        } else {
          setCurrentUser(null);
          setSessionStatus('error');
        }
      });

    return () => { mounted = false; };
  }, []);

  if (sessionStatus === 'checking') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Verificando sessão...</div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    const handleLogin = (info: SessionInfo) => {
      setCurrentUser(info.user);
      setCsrfToken(info.csrfToken ?? null);
      setMustChangePassword(Boolean(info.mustChangePassword));
      setSessionStatus('authenticated');
    };
    return <LoginPage onLogin={handleLogin} />;
  }

  if (sessionStatus === 'error') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-rose-600">Erro ao verificar sessão.</div>
      </div>
    );
  }

  // Security guard: if session reports authenticated but we don't have a currentUser,
  // treat as error/verification issue — do not render the authenticated UI or invent a user.
  if (sessionStatus === 'authenticated' && currentUser == null) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-rose-600">Erro ao verificar sessão.</div>
      </div>
    );
  }

  // Extra null-check to satisfy TypeScript narrowing: if currentUser is unexpectedly null,
  // do not proceed to render authenticated UI.
  if (currentUser == null) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-rose-600">Erro ao verificar sessão.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Topbar usuario={currentUser} onSair={() => setConfirmarSaida(true)} />

      {confirmarSaida && (
        <ModalConfirmaSaida
          onCancelar={() => setConfirmarSaida(false)}
          onConfirmar={handleConfirmLogout}
        />
      )}

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarMobile(true)}
        className="lg:hidden fixed bottom-5 left-5 z-40 w-12 h-12 bg-[#1a4b8c] rounded-full shadow-lg flex items-center justify-center text-white"
        aria-label="Abrir menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarMobile(false)} />
          <div className="relative z-10 w-64 h-full mt-14 shadow-xl">
            <Sidebar
              paginaAtual={pagina}
              onNavegar={navegar}
              perfil={currentUser.perfil}
              mobile
              onClose={() => setSidebarMobile(false)}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 pt-14">
        {/* Desktop sidebar */}
        <div className="hidden lg:block w-56 flex-shrink-0 fixed left-0 top-14 bottom-0">
            <Sidebar
              paginaAtual={pagina}
              onNavegar={navegar}
              perfil={currentUser.perfil}
            />
        </div>

        {/* Main content */}
        <main className="flex-1 lg:ml-56 p-5 lg:p-8 overflow-auto min-h-[calc(100vh-3.5rem)]">
          {pagina === 'dashboard' && (
            <DashboardPage
              onVerFicha={abrirFicha}
              onIrFichas={() => navegar('fichas')}
            />
          )}

          {pagina === 'fichas' && fichaAberta && (
            <FichaDetalhe
              fichaId={fichaAberta}
              csrfToken={csrfToken}
              onVoltar={voltarFichas}
            />
          )}

          {pagina === 'fichas' && !fichaAberta && (
            <FichasPage onVerFicha={abrirFicha} />
          )}

          {pagina === 'usuarios' && <UsuariosPage />}
        </main>
      </div>
    </div>
  );
}
