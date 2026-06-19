import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { tokenStore } from '../utils/tokenStore'

/**
 * Layout pathless protegido.
 * beforeLoad: verifica token em memória → redireciona para /login se inválido.
 * O redirect inclui ?redirect=<rota-atual> para retornar após autenticação.
 *
 * NOTA: o backend é a fonte de verdade. Esta guarda é apenas UX.
 * Tokens expirados são tratados pelo interceptor Axios (401 → logout automático).
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ location }) => {
    if (!tokenStore.isValid()) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.pathname,
        },
      })
    }
  },
  component: AppLayout,
})
