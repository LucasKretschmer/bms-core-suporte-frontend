import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { z } from 'zod'
import { tokenStore } from '../../../utils/tokenStore'

/**
 * Rota: /relatorios/tickets/$ticketId — Detalhe do ticket (F3, drill-down por id interno).
 *
 * Alcançada por drill-down de consumo-planos/clientes/apontamentos/cliente (não há
 * item de menu). Backend (AtendentePlus) é a fonte de verdade da autorização.
 */

const searchSchema = z.object({
  from: z
    .enum(['consumo-planos', 'apontamentos', 'cliente', 'clientes', 'dashboard'])
    .optional(),
  clientId: z.string().optional(),
})

const TicketDetailPage = lazyRouteComponent(
  () => import('../../../features/ticket-detail/index'),
)

export const Route = createFileRoute('/_auth/relatorios/tickets/$ticketId')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { ticketId } = useParams({ from: '/_auth/relatorios/tickets/$ticketId' })
  const { from, clientId } = useSearch({ from: '/_auth/relatorios/tickets/$ticketId' })
  return <TicketDetailPage ticketId={Number(ticketId)} from={from} clientId={clientId} />
}
