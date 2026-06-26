import { createRootRoute, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { ToastProvider } from '../components/ui/Toast'

// DevTools apenas em desenvolvimento — nunca em produção (security.md)
const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : () => null

function RootComponent() {
  return (
    <ToastProvider>
      <Outlet />
      {import.meta.env.DEV && (
        <Suspense>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </ToastProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
