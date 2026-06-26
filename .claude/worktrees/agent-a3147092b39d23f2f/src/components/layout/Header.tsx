import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'

type HeaderProps = {
  onMenuToggle?: () => void
  isSidebarCollapsed?: boolean
}

/** Header do app autenticado. Exibe nome do app, usuário logado e botão de logout. */
export function Header({ onMenuToggle, isSidebarCollapsed }: HeaderProps) {
  const { user, logout } = useAuth()
  const appName = import.meta.env.VITE_APP_NAME ?? 'BMS Core Suporte'

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-4 shrink-0">
      {/* Botão de toggle do sidebar */}
      <button
        type="button"
        onClick={onMenuToggle}
        aria-label={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        className="text-foreground/60 hover:text-foreground transition-colors rounded focus-visible:ring-2 focus-visible:ring-primary"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Nome do app */}
      <span className="font-semibold text-sm text-foreground hidden sm:block">{appName}</span>

      <div className="flex-1" />

      {/* Usuário + logout */}
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground/70 hidden md:block">
            {user.nome}
          </span>
          <Button variant="ghost" onClick={logout} aria-label="Sair do sistema">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline text-sm">Sair</span>
          </Button>
        </div>
      )}
    </header>
  )
}
