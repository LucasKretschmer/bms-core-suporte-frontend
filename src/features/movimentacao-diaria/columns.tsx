/**
 * Colunas da tabela de logs de Movimentação Diária (021).
 *
 * Whitelist de sortBy (backend): data, quantidade, equipe, atualizadoem.
 * Colunas: Data · Status · Equipe · Quantidade · Última atualização.
 *
 * AP-SECURITY-001: o texto de status vem de statusLabel congelado ou de um rótulo
 * PT-BR controlado pelo frontend — nunca a categoria HubSpot crua.
 */

import { Badge } from '../../components/ui/Badge'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import { formatDate, formatDateTime } from '../reports/shared/utils/formatters'
import { formatStatusDisplay } from './utils/statusBucket'
import type { MovimentacaoDiariaRowDto } from './types/movimentacaoDiaria'

/** Data YYYY-MM-DD → dd/MM/yyyy. Acrescenta T00:00 para evitar shift de fuso. */
function formatLogDate(isoDate: string): string {
  // formatDate espera um instante; data pura (YYYY-MM-DD) é interpretada como UTC.
  // Fixamos meio-dia para não cruzar a fronteira do dia em America/Sao_Paulo.
  return formatDate(`${isoDate}T12:00:00`)
}

export function buildMovimentacaoDiariaColumns(): ColumnDef<MovimentacaoDiariaRowDto>[] {
  return [
    {
      key: 'data',
      header: 'Data',
      sortable: true,
      sortKey: 'data',
      align: 'left',
      width: '120px',
      accessor: (row) => formatLogDate(row.data),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: false,
      align: 'center',
      width: '200px',
      accessor: (row) => (
        <div className="flex justify-center">
          <Badge value={formatStatusDisplay(row.statusBucket, row.statusLabel)} truncate className="max-w-[180px]" />
        </div>
      ),
    },
    {
      key: 'equipe',
      header: 'Equipe',
      sortable: true,
      sortKey: 'equipe',
      align: 'left',
      accessor: (row) =>
        row.equipe ?? <span className="text-foreground/40">Sem equipe</span>,
    },
    {
      key: 'quantidade',
      header: 'Quantidade',
      sortable: true,
      sortKey: 'quantidade',
      align: 'right',
      width: '120px',
      accessor: (row) => row.quantidade,
    },
    {
      key: 'atualizadoEm',
      header: 'Última atualização',
      sortable: true,
      sortKey: 'atualizadoem',
      align: 'left',
      width: '170px',
      accessor: (row) => formatDateTime(row.atualizadoEm),
    },
  ]
}
