import { Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Shell autenticado: Sidebar + Header + <main><Outlet /></main>.
 * A guarda de auth fica no nível de rota (_auth.tsx), não aqui.
 * Estado colapsado do Sidebar persiste em localStorage (preferência de UI).
 */
export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(loadCollapsed)

  function toggleSidebar() {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // Falha silenciosa
      }
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar isCollapsed={isCollapsed} />

      {/* Conteúdo principal */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuToggle={toggleSidebar} isSidebarCollapsed={isCollapsed} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
