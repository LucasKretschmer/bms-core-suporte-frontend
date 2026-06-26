import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
  useParams,
} from '@tanstack/react-router'
import { z } from 'zod'
import { tokenStore } from '../../../utils/tokenStore'

/**
 * Rota: /relatorios/clientes/$clientId — Tickets do cliente (F2, drill-down).
 *
 * Acessível apenas via drill-down de Consumo de Planos (não há item de menu).
 * A role efetiva (B1 = AtendentePlus; alcançada por CoordenadorPlus) é validada
 * pelo backend — esta guarda cobre apenas o token (UX).
 */

const searchSchema = z.object({
  from: z.enum(['consumo-planos']).optional(),
})

const ClientTicketsPage = lazyRouteComponent(
  () => import('../../../features/client-tickets/index'),
)

export const Route = createFileRoute('/_auth/relatorios/clientes/$clientId')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { clientId } = useParams({ from: '/_auth/relatorios/clientes/$clientId' })
  return <ClientTicketsPage clientId={Number(clientId)} />
}
