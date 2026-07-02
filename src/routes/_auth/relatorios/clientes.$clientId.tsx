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
 * Rota: /relatorios/clientes/$clientId — Tickets do cliente (F2, drill-down).
 *
 * Acessível apenas via drill-down de Consumo de Planos (não há item de menu).
 * A role efetiva (B1 = AtendentePlus; alcançada por CoordenadorPlus) é validada
 * pelo backend — esta guarda cobre apenas o token (UX).
 */

const searchSchema = z.object({
  // 'dashboard' = origem do drill-down de Saúde dos Planos (016).
  // ATENÇÃO: `from` aqui é o ENUM de ORIGEM do drill-down — NÃO é data.
  from: z.enum(['consumo-planos', 'dashboard']).optional(),
  // Período pré-preenchido a partir da origem (095), YYYY-MM-DD.
  // Nomes propositalmente distintos de `from` (enum de origem) para não colidir.
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
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
  const { dateFrom, dateTo } = useSearch({
    from: '/_auth/relatorios/clientes/$clientId',
  })
  return (
    <ClientTicketsPage
      clientId={Number(clientId)}
      initialFrom={dateFrom ?? null}
      initialTo={dateTo ?? null}
    />
  )
}
