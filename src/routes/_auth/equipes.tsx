import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../utils/tokenStore'

/**
 * Rota: /equipes — Equipes e Atendentes (F7).
 * Auth: autenticado. Guarda de role (CoordenadorPlus) aplicada na página/Sidebar (UX).
 * O backend é a fonte de verdade (403 se sem permissão).
 */
export const Route = createFileRoute('/_auth/equipes')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(() => import('../../features/teams/index')),
})
