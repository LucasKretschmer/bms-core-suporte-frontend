import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../../utils/tokenStore'

/**
 * Rota: /relatorios/produtividade
 * Auth: autenticado + CoordenadorPlus (restrito — escondido para Atendente)
 *
 * ANTI-CONFLITO (Fase 1):
 * - NÃO editar este arquivo na Fase 1
 * - A Fase 1 implementa APENAS src/features/reports/productivity/index.tsx
 *   (e arquivos da mesma pasta: columns.ts, hooks/useProductivity.ts)
 *
 * NOTA sobre a guarda de role:
 * beforeLoad não tem acesso a hooks React, portanto não pode chamar usePermissions().
 * A guarda real de CoordenadorPlus é aplicada via:
 * 1. Sidebar (visibilidade do item — UX)
 * 2. Backend (403 se não autorizado — fonte de verdade)
 * Em caso de acesso direto pela URL, o backend retornará 403 e a página exibirá ErrorState.
 */
export const Route = createFileRoute('/_auth/relatorios/produtividade')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(
    () => import('../../../features/reports/productivity/index'),
  ),
})
