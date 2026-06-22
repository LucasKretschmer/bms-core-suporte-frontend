import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { FullPageLoader } from './components/ui/FullPageLoader'

/**
 * Instância singleton do router.
 *
 * Extraída de main.tsx para permitir navegação fora de componentes de rota
 * (ex.: AuthProvider, montado fora do RouterProvider) via `router.navigate(...)`.
 * Importar `useNavigate()` em um provider fora do RouterProvider resulta em
 * navegação no-op — por isso usamos esta instância em providers.
 *
 * defaultPendingComponent: feedback acessível durante `beforeLoad` assíncrono
 * (rehydrate de sessão no F5) — nunca tela branca.
 */
export const router = createRouter({
  routeTree,
  context: {},
  defaultPendingComponent: FullPageLoader,
  defaultPendingMs: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
