import type { Perfil } from '../data/mockData';

type Pagina = 'dashboard' | 'fichas' | 'usuarios';

interface SidebarProps {
  paginaAtual: Pagina;
  onNavegar: (p: Pagina) => void;
  perfil: Perfil;
  mobile?: boolean;
  onClose?: () => void;
}

const navItems = [
  {
    id: 'dashboard' as Pagina,
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: 'fichas' as Pagina,
    label: 'Fichas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
];

const adminItems = [
  {
    id: 'usuarios' as Pagina,
    label: 'Usuários',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    adminOnly: true,
  },
];

export function Sidebar({ paginaAtual, onNavegar, perfil, mobile, onClose }: SidebarProps) {
  const allItems = perfil === 'ADMINISTRADOR' ? [...navItems, ...adminItems] : navItems;

  return (
    <aside className={`${mobile ? 'w-full' : 'w-56'} bg-white border-r border-slate-200 flex flex-col py-4 h-full`}>
      {mobile && onClose && (
        <div className="flex justify-end px-4 mb-2">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 py-2">Menu principal</p>
        {allItems.map(item => {
          const isActive = paginaAtual === item.id;
          const isDisabled = item.id === 'usuarios' && perfil !== 'ADMINISTRADOR';
          if (isDisabled) return null;
          return (
            <button
              key={item.id}
              onClick={() => { onNavegar(item.id); onClose?.(); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                isActive
                  ? 'bg-[#1a4b8c] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
              {item.label}
              {item.id === 'usuarios' && (
                <span className="ml-auto text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">Em breve</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-4 pt-4 border-t border-slate-100 mt-auto">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Projeto Semente Azul
        </p>
      </div>
    </aside>
  );
}
