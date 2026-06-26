import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { tokenStore } from '../utils/tokenStore'
import { ensureSession } from '../utils/ensureSession'

/**
 * Layout pathless protegido.
 *
 * beforeLoad (assíncrono): se não há sessão em memória, tenta reidratar via
 * `ensureSession()` (POST /auth/refresh com cookie httpOnly) ANTES de
 * redirecionar para /login. Isso sobrevive ao F5 e evita o flash de login
 * (o router aguarda a Promise e exibe o defaultPendingComponent).
 *
 * NOTA: o backend é a fonte de verdade. Esta guarda é apenas UX.
 * Expiração do access token é tratada pelo interceptor Axios (401 → refresh).
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    if (tokenStore.isValid()) return // sessão em memória — segue

    await ensureSession() // tenta refresh UMA vez (memoizado, lock único)
    if (tokenStore.isValid()) return // refresh ok — segue

    throw redirect({
      to: '/login',
      search: {
        redirect: location.pathname,
      },
    })
  },
  component: AppLayout,
})
