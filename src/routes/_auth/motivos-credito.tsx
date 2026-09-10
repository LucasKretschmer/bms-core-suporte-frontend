import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../utils/tokenStore'

/**
 * Rota: /motivos-credito — Motivos de Crédito (132/F6).
 *
 * Auth: autenticado (`beforeLoad`). Guarda de role `GerentePlus` (D10) na própria página
 * (`features/hour-credit-reasons/index.tsx`) — UX apenas; o backend decide.
 *
 * `kebab-case` no nome do arquivo (`rules/frontend.md` § Navegação).
 */
export const Route = createFileRoute('/_auth/motivos-credito')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(() => import('../../features/hour-credit-reasons/index')),
})
