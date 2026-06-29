/**
 * Colunas da tabela de drill-down da família PROJETO (016 B4 — Onboarding).
 *
 * Função pura (testável). `sortKey` reflete a whitelist do backend
 * (nome | cliente | owner | stage | iniciadoem | concluidoem).
 * R5: a linha NÃO navega (não existe tela de detalhe de projeto) — só exibição.
 */

import { formatDate } from '../../../reports/shared/utils/formatters'
import type { ColumnDef } from '../../../../components/ui/DataTable/types'
import type { ProjectRowDto } from '../types/metrics'

function fmtDate(iso: string | null): string {
  return iso ? formatDate(iso) : '—'
}

export function projetoDrillColumns(): ColumnDef<ProjectRowDto>[] {
  return [
    {
      key: 'nome',
      header: 'Projeto',
      accessor: (row) => row.nome ?? '—',
      sortable: true,
      sortKey: 'nome',
      align: 'left',
    },
    {
      key: 'clienteNome',
      header: 'Cliente',
      accessor: (row) => row.clienteNome ?? '—',
      sortable: true,
      sortKey: 'cliente',
      align: 'left',
    },
    {
      key: 'tipo',
      header: 'Tipo',
      accessor: (row) => row.tipo,
      align: 'left',
    },
    {
      key: 'stage',
      header: 'Estágio',
      accessor: (row) => row.stage,
      sortable: true,
      sortKey: 'stage',
      align: 'left',
    },
    {
      key: 'ownerNome',
      header: 'Responsável',
      accessor: (row) => row.ownerNome ?? '—',
      sortable: true,
      sortKey: 'owner',
      align: 'left',
    },
    {
      key: 'equipe',
      header: 'Equipe',
      accessor: (row) => row.equipe ?? '—',
      align: 'left',
    },
    {
      key: 'iniciadoEm',
      header: 'Iniciado em',
      accessor: (row) => fmtDate(row.iniciadoEm),
      sortable: true,
      sortKey: 'iniciadoem',
      align: 'center',
    },
    {
      key: 'concluidoEm',
      header: 'Concluído em',
      accessor: (row) => fmtDate(row.concluidoEm),
      sortable: true,
      sortKey: 'concluidoem',
      align: 'center',
    },
  ]
}
