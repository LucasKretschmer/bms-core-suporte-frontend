import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { tokenStore } from '../../utils/tokenStore'

/**
 * Rota: /creditos — Créditos de Horas (132/F5).
 *
 * Auth: autenticado (`beforeLoad`). A guarda de **role `GerentePlus` (D10)** vive na
 * página (`features/hour-credits/index.tsx`), como no Sincronizador e nas Categorias —
 * UX apenas; o backend é a fonte de verdade e devolve `403`.
 *
 * Irmã de `/sincronizador` e `/categorias`, mesmo nível: o pai `_auth.tsx` já existe e já
 * renderiza `<Outlet />`, então `AP-FRONTEND-024`/`025` (rota-pai sem outlet, pai criado
 * depois do filho) não se aplicam aqui.
 */
export const Route = createFileRoute('/_auth/creditos')({
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: lazyRouteComponent(() => import('../../features/hour-credits/index')),
})
