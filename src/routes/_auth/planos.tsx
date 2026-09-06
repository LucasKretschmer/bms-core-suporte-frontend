import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../utils/tokenStore'

/**
 * Rota: /planos — Planos de Suporte (124/F1).
 * Auth: autenticado. Guarda de role (CoordenadorPlus para ver, GerentePlus para editar)
 * aplicada na página/Sidebar (UX). O backend é a fonte de verdade
 * (`SupportPlansController.cs:29,42,63` — 403 se sem permissão).
 */
export const Route = createFileRoute('/_auth/planos')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(() => import('../../features/support-plans/index')),
})
