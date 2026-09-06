import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../utils/tokenStore'

/**
 * Rota: /calendario — Calendário Comercial (124/F2+F3).
 * Auth: autenticado. Guarda de role (CoordenadorPlus para ver, GerentePlus para editar)
 * aplicada na página/Sidebar (UX). O backend é a fonte de verdade
 * (`CalendarsController.cs`/`HolidaysController.cs` — 403 se sem permissão).
 */
export const Route = createFileRoute('/_auth/calendario')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(() => import('../../features/business-calendar/index')),
})
