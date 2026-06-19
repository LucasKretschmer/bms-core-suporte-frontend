import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: lazyRouteComponent(() => import('../features/auth/index')),
})
