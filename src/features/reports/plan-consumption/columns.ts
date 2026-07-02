import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { PlanConsumptionItemDto } from '../shared/types/reports'
import { formatHours, formatPercent } from '../shared/utils/formatters'
import React from 'react'

/** Aplica máscara de CNPJ: XX.XXX.XXX/XXXX-XX */
function formatCnpj(cnpj: string | null): string {
  if (!cnpj) return '—'
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/**
 * Cor do percentual de plano:
 * < 80%  → verde
 * 80–95% → amarelo
 * ≥ 95%  → vermelho (pode exceder 100%)
 */
export type PercentClass = 'green' | 'yellow' | 'red' | 'neutral'

export function getPercentClass(value: number | null): PercentClass {
  if (value === null) return 'neutral'
  if (value < 80) return 'green'
  if (value < 95) return 'yellow'
  return 'red'
}

const percentColorClasses: Record<PercentClass, string> = {
  green: 'text-green-700 font-medium',
  yellow: 'text-yellow-700 font-medium',
  red: 'text-red-700 font-medium',
  neutral: 'text-foreground',
}

/**
 * Colunas da tabela U3 — Consumo de Planos.
 * Ordem exata conforme PRD. sortKey deve casar com a whitelist do backend.
 */
export const planConsumptionColumns: ColumnDef<PlanConsumptionItemDto>[] = [
  {
    key: 'cnpj',
    header: 'CNPJ',
    sortable: true,
    sortKey: 'cnpj',
    align: 'left',
    accessor: (row) => formatCnpj(row.cnpj),
  },
  {
    key: 'nomeFantasia',
    header: 'Nome Fantasia',
    sortable: true,
    sortKey: 'nomefantasia',
    align: 'left',
    accessor: (row) => row.nomeFantasia ?? '—',
  },
  {
    key: 'razaoSocial',
    header: 'Razão Social',
    sortable: true,
    sortKey: 'razaosocial',
    align: 'left',
    accessor: (row) => row.razaoSocial ?? '—',
  },
  {
    key: 'nomePlano',
    header: 'Nome do Plano',
    sortable: true,
    sortKey: 'nomeplano',
    align: 'left',
    accessor: (row) => row.nomePlano ?? '—',
  },
  {
    key: 'qtdePlanoHoras',
    header: 'Qtde. Plano (h)',
    sortable: true,
    sortKey: 'qtdeplano',
    align: 'right',
    accessor: (row) => formatHours(row.qtdePlanoHoras),
  },
  {
    key: 'horasUsadas',
    header: 'Horas Usadas',
    sortable: true,
    sortKey: 'horasusadas',
    align: 'right',
    accessor: (row) => formatHours(row.horasUsadas),
  },
  {
    key: 'horasRestantes',
    header: 'Horas Restantes',
    sortable: true,
    sortKey: 'horasrestantes',
    align: 'right',
    accessor: (row) => formatHours(row.horasRestantes),
  },
  {
    key: 'horasAdicionais',
    header: 'Horas Adicionais',
    headerInfo: 'Horas consumidas além do plano contratado.',
    sortable: true,
    sortKey: 'horasadicionais',
    align: 'right',
    accessor: (row) => formatHours(row.horasAdicionais),
  },
  {
    key: 'percentualPlano',
    header: '% do Plano',
    sortable: true,
    sortKey: 'percentual',
    align: 'right',
    accessor: (row) => {
      const colorClass = percentColorClasses[getPercentClass(row.percentualPlano)]
      return React.createElement('span', { className: colorClass }, formatPercent(row.percentualPlano))
    },
  },
  {
    key: 'horasFaturaveis',
    header: 'Horas Faturáveis',
    headerInfo: 'Horas cobradas fora do plano (billableOutsidePlan).',
    sortable: true,
    sortKey: 'horasfaturaveis',
    align: 'right',
    accessor: (row) => formatHours(row.horasFaturaveis),
  },
  {
    key: 'horasAnalise',
    header: 'Horas de Análise',
    headerInfo: 'Horas em tickets de análise interna.',
    sortable: true,
    sortKey: 'horasanalise',
    align: 'right',
    accessor: (row) => formatHours(row.horasAnalise),
  },
]
