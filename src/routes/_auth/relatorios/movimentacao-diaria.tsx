import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../../utils/tokenStore'

/**
 * Rota: /relatorios/movimentacao-diaria (021 — item 38)
 * Auth: autenticado + CoordenadorPlus.
 *
 * A guarda de role é UX (Sidebar/página). O backend é a fonte de verdade e
 * retorna 403 se não autorizado.
 */
export const Route = createFileRoute('/_auth/relatorios/movimentacao-diaria')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(
    () => import('../../../features/movimentacao-diaria/index'),
  ),
})
