import type { BreadcrumbItem } from '../../../components/layout/Breadcrumb'

/** Origem do drill-down (search param `from`). */
export type TicketDetailOrigin =
  | 'consumo-planos'
  | 'apontamentos'
  | 'cliente'
  | 'clientes'
  | undefined

type BuildBreadcrumbInput = {
  from: TicketDetailOrigin
  clientId?: string
  clienteNome?: string | null
  hubspotTicketId: string
}

/**
 * Monta a cadeia de breadcrumb do detalhe do ticket conforme a origem (F5/R2).
 *
 * - consumo-planos / clientes: Relatórios • Consumo de Planos • [Cliente] • #[Ticket]
 * - apontamentos:              Relatórios • Apontamentos por Ticket • #[Ticket]
 * - cliente:                   Relatórios • Relatório do Cliente • #[Ticket]
 * - (sem origem):              Relatórios • #[Ticket]
 *
 * O item Cliente intermediário só aparece quando a origem é consumo-planos/clientes
 * e há clientId. O item final (ticket) nunca tem href.
 */
export function buildTicketBreadcrumb({
  from,
  clientId,
  clienteNome,
  hubspotTicketId,
}: BuildBreadcrumbInput): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: 'Relatórios' }]
  const ticketLabel = `#${hubspotTicketId}`

  if (from === 'consumo-planos' || from === 'clientes') {
    items.push({
      label: 'Consumo de Planos',
      href: '/relatorios/consumo-planos',
    })
    if (clientId) {
      items.push({
        label: clienteNome || 'Cliente',
        href: '/relatorios/clientes/$clientId',
        params: { clientId },
        search: { from: 'consumo-planos' },
      })
    }
  } else if (from === 'apontamentos') {
    items.push({
      label: 'Apontamentos por Ticket',
      href: '/relatorios/apontamentos',
    })
  } else if (from === 'cliente') {
    items.push({
      label: 'Relatório do Cliente',
      href: '/relatorios/cliente',
    })
  }

  items.push({ label: ticketLabel })
  return items
}
