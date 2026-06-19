import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../../utils/tokenStore'

/**
 * Rota: /relatorios/consumo-planos
 * Auth: autenticado + CoordenadorPlus
 *
 * ANTI-CONFLITO (Fase 1):
 * - NÃO editar este arquivo na Fase 1
 * - NÃO regenerar routeTree.gen.ts manualmente
 * - A Fase 1 implementa APENAS src/features/reports/plan-consumption/index.tsx
 *   (e arquivos da mesma pasta: columns.ts, hooks/usePlanConsumption.ts)
 */
export const Route = createFileRoute('/_auth/relatorios/consumo-planos')({
  beforeLoad: () => {
    // Nota: a verificação de token é feita pelo _auth.tsx pai.
    // Esta guarda adicional lida com a role CoordenadorPlus.
    // Como usePermissions é um hook React, não pode ser chamado em beforeLoad.
    // A guarda de role é aplicada na página e no Sidebar (UX).
    // O backend é a fonte de verdade e retornará 403 se não autorizado.
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(
    () => import('../../../features/reports/plan-consumption/index'),
  ),
})
