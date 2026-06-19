import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../../utils/tokenStore'

/**
 * Rota: /dashboards/onboarding
 * Auth: autenticado + CoordenadorPlus
 *
 * ANTI-CONFLITO (Fase 1):
 * - NÃO editar este arquivo na Fase 1
 * - NÃO regenerar routeTree.gen.ts manualmente
 * - A Fase 1C implementa APENAS src/features/dashboards/onboarding/index.tsx
 *   e Sections dentro de src/features/dashboards/onboarding/components/
 */
export const Route = createFileRoute('/_auth/dashboards/onboarding')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(
    () => import('../../../features/dashboards/onboarding/index'),
  ),
})
