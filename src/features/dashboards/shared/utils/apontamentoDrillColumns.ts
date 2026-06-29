/**
 * Colunas da tabela de drill-down da família APONTAMENTO (016 B1).
 *
 * Função pura (testável). As mesmas colunas servem todos os metric de apontamento
 * (apontamentos, apontamentos-com-pausa) e todos os params (billing/serviceCategory/
 * categoria/userId) — o conjunto de LINHAS muda no backend, não as colunas.
 *
 * AP-SECURITY-001: NÃO expõe a categoria HubSpot crua. `categorizacaoAtendimento` é a
 * categorização interna do atendimento (ex.: "Plantão"), não a categoria do ticket.
 *
 * `sortKey` reflete a whitelist de ordenação do backend (inicioem | totalsegundos | atendente).
 */

import { formatDate, formatSeconds } from '../../../reports/shared/utils/formatters'
import type { ColumnDef } from '../../../../components/ui/DataTable/types'
import type { TimeEntryDrillRowDto } from '../types/metrics'

export function apontamentoDrillColumns(): ColumnDef<TimeEntryDrillRowDto>[] {
  return [
    {
      key: 'hubspotTicketId',
      header: 'Ticket',
      accessor: (row) => `#${row.hubspotTicketId}`,
      align: 'left',
    },
    {
      key: 'assunto',
      header: 'Assunto',
      accessor: (row) => row.assunto ?? '—',
      align: 'left',
    },
    {
      key: 'atendente',
      header: 'Atendente',
      accessor: (row) => row.atendente,
      sortable: true,
      sortKey: 'atendente',
      align: 'left',
    },
    {
      key: 'equipe',
      header: 'Equipe',
      accessor: (row) => row.equipe ?? '—',
      align: 'left',
    },
    {
      key: 'dataApontamento',
      header: 'Data',
      accessor: (row) => formatDate(row.dataApontamento),
      sortable: true,
      sortKey: 'inicioem',
      align: 'center',
    },
    {
      key: 'totalSegundos',
      header: 'Tempo',
      accessor: (row) => formatSeconds(row.totalSegundos),
      sortable: true,
      sortKey: 'totalsegundos',
      align: 'right',
    },
  ]
}
