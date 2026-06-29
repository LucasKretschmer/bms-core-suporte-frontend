/**
 * Colunas da tabela de drill-down da família CLIENTE (016 B3 — Saúde dos Planos).
 *
 * Função pura (testável). `sortKey` reflete a whitelist do backend
 * (nomefantasia | plannome | horascontratadas | horasconsumidas | percentual).
 * AP-SECURITY-001: só nome do cliente/plano + métricas de consumo — sem categoria HubSpot.
 */

import { formatHours, formatPercent } from '../../../reports/shared/utils/formatters'
import type { ColumnDef } from '../../../../components/ui/DataTable/types'
import type { ClientRowDto } from '../types/metrics'

const FAIXA_LABEL: Record<ClientRowDto['faixa'], string> = {
  verde: 'Ok (< 80%)',
  amarelo: 'Atenção (80–95%)',
  vermelho: 'Crítico (≥ 95%)',
}

export function clienteDrillColumns(): ColumnDef<ClientRowDto>[] {
  return [
    {
      key: 'nomeFantasia',
      header: 'Cliente',
      accessor: (row) => row.nomeFantasia ?? '—',
      sortable: true,
      sortKey: 'nomefantasia',
      align: 'left',
    },
    {
      key: 'planNome',
      header: 'Plano',
      accessor: (row) => row.planNome ?? '—',
      sortable: true,
      sortKey: 'plannome',
      align: 'left',
    },
    {
      key: 'horasContratadas',
      header: 'Horas do plano',
      accessor: (row) => formatHours(row.horasContratadas),
      sortable: true,
      sortKey: 'horascontratadas',
      align: 'right',
    },
    {
      key: 'horasConsumidas',
      header: 'Horas usadas',
      accessor: (row) => formatHours(row.horasConsumidas),
      sortable: true,
      sortKey: 'horasconsumidas',
      align: 'right',
    },
    {
      key: 'percentualConsumo',
      header: 'Consumo',
      accessor: (row) => formatPercent(row.percentualConsumo),
      sortable: true,
      sortKey: 'percentual',
      align: 'right',
    },
    {
      key: 'faixa',
      header: 'Saúde',
      accessor: (row) => FAIXA_LABEL[row.faixa] ?? row.faixa,
      align: 'center',
    },
  ]
}
