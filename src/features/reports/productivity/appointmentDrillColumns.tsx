import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { AppointmentReportItemDto } from '../shared/types/reports'
import { formatDateTime, formatSeconds } from '../shared/utils/formatters'
import { AlertaDeLimite } from './components/AlertaDeLimite'
import { VALOR_AUSENTE } from './productivityFormat'

export const TEXTO_ACIMA_DO_LIMITE = 'Acima do limite'

/** Colunas do drill de apontamentos do analista. sortKey segue a whitelist do backend. */
export const appointmentDrillColumns: ColumnDef<AppointmentReportItemDto>[] = [
  {
    key: 'hubspotTicketId',
    header: 'Ticket',
    sortable: true,
    sortKey: 'hubspotticketid',
    align: 'left',
    accessor: (row) => `#${row.hubspotTicketId}`,
  },
  {
    key: 'assunto',
    header: 'Assunto',
    align: 'left',
    accessor: (row) => row.assunto ?? VALOR_AUSENTE,
  },
  {
    key: 'clienteNome',
    header: 'Cliente',
    align: 'left',
    accessor: (row) => row.clienteNome ?? VALOR_AUSENTE,
  },
  {
    key: 'categorizacaoAtendimento',
    header: 'Categorização',
    align: 'left',
    accessor: (row) => row.categorizacaoAtendimento ?? VALOR_AUSENTE,
  },
  {
    key: 'dataApontamento',
    header: 'Data',
    sortable: true,
    sortKey: 'inicioem',
    align: 'center',
    accessor: (row) => formatDateTime(row.dataApontamento),
  },
  {
    key: 'totalSegundos',
    header: 'Tempo',
    sortable: true,
    sortKey: 'totalsegundos',
    align: 'right',
    accessor: (row) =>
      row.acimaDoLimite === true ? (
        <span className="inline-flex items-center gap-2">
          <AlertaDeLimite texto={TEXTO_ACIMA_DO_LIMITE} />
          {formatSeconds(row.totalSegundos)}
        </span>
      ) : (
        formatSeconds(row.totalSegundos)
      ),
  },
]
