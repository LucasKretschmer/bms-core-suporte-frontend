import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

/**
 * Rota: /relatorios/cliente
 * Auth: autenticado + CoordenadorPlus
 *
 * ANTI-CONFLITO (Fase 1):
 * - NÃO editar este arquivo na Fase 1
 * - A Fase 1 implementa APENAS src/features/reports/client-report/index.tsx
 *   (e arquivos da mesma pasta: columns.ts, hooks/useClientReport.ts,
 *    components/ClientReportHeader.tsx, components/ClientReportPdf.tsx)
 */
export const Route = createFileRoute('/_auth/relatorios/cliente')({
  component: lazyRouteComponent(
    () => import('../../../features/reports/client-report/index'),
  ),
})
