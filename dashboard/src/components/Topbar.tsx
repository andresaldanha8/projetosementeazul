interface TopbarUsuario {
  nome: string;
  perfil: 'ADMINISTRADOR' | 'CADASTRADOR';
}

interface TopbarProps {
  usuario: TopbarUsuario;
  onSair: () => void;
}

export function Topbar({ usuario, onSair }: TopbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#1a4b8c] shadow-md flex items-center px-4 lg:px-6 gap-4">
      {/* Logo + nome */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9s-9-4.03-9-9a9 9 0 0 1 9-9z"/>
            <path d="M12 11c-1.5-2-4-3-6-2"/>
            <path d="M12 11c1.5-2 4-3 6-2"/>
            <path d="M12 11v8"/>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="font-display font-800 text-white text-sm leading-tight tracking-wide">Projeto Semente Azul</p>
          <p className="text-white/60 text-[10px] leading-tight hidden sm:block">Sistema de Gestão de Cadastros</p>
        </div>
      </div>

      <div className="flex-1" />

      {/* Usuário */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="text-right hidden sm:block min-w-0">
          <p className="text-white text-xs font-medium leading-tight truncate max-w-[160px]">{usuario.nome}</p>
          <p className="text-white/60 text-[10px] leading-tight">{usuario.perfil}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {usuario.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </div>
        <button
          onClick={onSair}
          className="text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors px-2 py-1.5 rounded hover:bg-white/10 flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
