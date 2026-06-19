import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../../utils/tokenStore'

/**
 * Rota: /dashboards/suporte
 * Auth: autenticado + CoordenadorPlus
 *
 * ANTI-CONFLITO (Fase 1):
 * - NÃO editar este arquivo na Fase 1
 * - NÃO regenerar routeTree.gen.ts manualmente
 * - A Fase 1 implementa APENAS src/features/dashboards/support/index.tsx
 *   e Sections dentro de src/features/dashboards/support/components/
 */
export const Route = createFileRoute('/_auth/dashboards/suporte')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(
    () => import('../../../features/dashboards/support/index'),
  ),
})
