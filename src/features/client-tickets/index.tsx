/**
 * F2 — Tela "Tickets do cliente" (/relatorios/clientes/$clientId).
 *
 * Drill-down de Consumo de Planos. O conteúdo (KPIs + tabela + estados) mora em
 * ClientTicketsPanel (reutilizável). Esta página só fornece o PageWrapper,
 * breadcrumb e a navegação para o detalhe do ticket.
 *
 * Privacidade (R5): esta é a visão interna de drill-down, não o relatório/PDF do
 * cliente. Mostrar dados internos do ticket aqui é permitido.
 */

import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { formatClientName } from '../reports/shared/utils/formatters'
import { ClientTicketsPanel } from './components/ClientTicketsPanel'
import type { ClientTicketItemDto } from './types/clientTickets'
import { useClientKpis } from './hooks/useClientKpis'

type ClientTicketsPageProps = {
  clientId: number
  /** Período inicial (YYYY-MM-DD) vindo dos search params da rota (095). */
  initialFrom?: string | null
  initialTo?: string | null
}

export default function ClientTicketsPage({
  clientId,
  initialFrom = null,
  initialTo = null,
}: ClientTicketsPageProps) {
  const navigate = useNavigate()
  const kpisQuery = useClientKpis(clientId)

  const clientName = kpisQuery.data ? formatClientName(kpisQuery.data) : 'Cliente'

  const handleTicketClick = useCallback(
    (row: ClientTicketItemDto) => {
      void navigate({
        to: '/relatorios/tickets/$ticketId',
        params: { ticketId: String(row.ticketId) },
        search: { from: 'clientes', clientId: String(clientId) },
      })
    },
    [navigate, clientId],
  )

  return (
    <PageWrapper
      title={`Tickets — ${clientName}`}
      breadcrumbItems={[
        { label: 'Relatórios' },
        {
          label: 'Consumo de Planos',
          href: '/relatorios/consumo-planos',
        },
        { label: clientName },
      ]}
    >
      <ClientTicketsPanel
        clientId={clientId}
        onTicketClick={handleTicketClick}
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  )
}
