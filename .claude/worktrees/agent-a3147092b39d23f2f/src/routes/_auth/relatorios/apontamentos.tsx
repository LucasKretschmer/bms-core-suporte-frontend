import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

/**
 * Rota: /relatorios/apontamentos
 * Auth: todos os usuários autenticados (AtendentePlus)
 *
 * ANTI-CONFLITO (Fase 1):
 * - NÃO editar este arquivo na Fase 1
 * - A Fase 1 implementa APENAS src/features/reports/appointments/index.tsx
 *   (e arquivos da mesma pasta: columns.ts, hooks/useAppointments.ts)
 */
export const Route = createFileRoute('/_auth/relatorios/apontamentos')({
  component: lazyRouteComponent(
    () => import('../../../features/reports/appointments/index'),
  ),
})
