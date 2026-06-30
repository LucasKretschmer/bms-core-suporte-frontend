import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

/**
 * Rota: /relatorios/apontamentos-projeto
 * Auth: todos os usuários autenticados (AtendentePlus) — espelha /relatorios/apontamentos.
 *
 * 057 — Apontamentos por Projeto (visão project-centric, separada da de tickets).
 */
export const Route = createFileRoute('/_auth/relatorios/apontamentos-projeto')({
  component: lazyRouteComponent(
    () => import('../../../features/reports/project-appointments/index'),
  ),
})
