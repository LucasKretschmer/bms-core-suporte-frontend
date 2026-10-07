import type { ProductivitySummaryDto } from '../shared/types/reports'
import { formatNumeroOpcional, formatSegundosOpcional } from './productivityFormat'

export type SummaryCardVariant = 'global' | 'atendente'

export type SummaryCard = {
  label: string
  value: string
}

/**
 * Cards do resumo de produtividade, na ordem de exibição.
 * Sem resumo (ainda carregando ou com erro) todo valor sai como ausente.
 */
export function buildSummaryCards(
  summary: ProductivitySummaryDto | null | undefined,
  variant: SummaryCardVariant,
): SummaryCard[] {
  const tempoTotal = formatSegundosOpcional(summary?.totalSegundos)
  const mediaPorTicket = formatSegundosOpcional(summary?.mediaSegundosPorTicket)
  const medianaPorTicket = formatSegundosOpcional(summary?.medianaSegundosPorTicket)

  if (variant === 'atendente') {
    return [
      { label: 'Tempo total', value: tempoTotal },
      { label: 'Atendimentos', value: formatNumeroOpcional(summary?.totalAtendimentos) },
      { label: 'Tickets', value: formatNumeroOpcional(summary?.totalTickets) },
      { label: 'Média de tempo por ticket', value: mediaPorTicket },
      { label: 'Mediana de tempo por ticket', value: medianaPorTicket },
    ]
  }

  return [
    { label: 'Tempo total', value: tempoTotal },
    {
      label: 'Média de atendimentos por atendente',
      value: formatNumeroOpcional(summary?.mediaAtendimentosPorAtendente, 2),
    },
    {
      label: 'Mediana de atendimentos por atendente',
      value: formatNumeroOpcional(summary?.medianaAtendimentosPorAtendente, 2),
    },
    { label: 'Média de tempo por ticket', value: mediaPorTicket },
    { label: 'Mediana de tempo por ticket', value: medianaPorTicket },
  ]
}
