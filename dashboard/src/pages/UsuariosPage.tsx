export function UsuariosPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800">Usuários e Cadastradores</h1>
        <p className="text-slate-500 text-sm mt-1">Gerenciamento de usuários do sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-[#1a4b8c]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a4b8c" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h2 className="font-display font-bold text-slate-700 text-lg">Área em desenvolvimento</h2>
        <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
          O gerenciamento de usuários e cadastradores estará disponível em breve. Esta área permitirá criar, editar e desativar usuários do sistema.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-4 py-2 rounded-full">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Disponível somente para perfil ADMINISTRADOR
        </div>
      </div>
    </div>
  );
}
