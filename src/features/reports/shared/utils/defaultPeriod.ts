import { format, startOfMonth } from 'date-fns'

/**
 * Período padrão compartilhado das telas de relatório/listagem.
 *
 * Default = mês corrente: do 1º dia do mês até a data de referência (hoje).
 * Formato YYYY-MM-DD (mesmo do PeriodFilter mode="date" e dos serviços).
 *
 * Usa `format(date, 'yyyy-MM-dd')` (fuso LOCAL) — nunca `toISOString()`, que é UTC
 * e pode gerar off-by-one de um dia em America/Sao_Paulo (UTC-3) perto da meia-noite.
 *
 * O período é sempre OPCIONAL/clearable: as telas guardam `from`/`to` como
 * `string | null` e o usuário pode limpar para `null`. Este helper apenas fornece
 * o valor inicial.
 *
 * Reusado por: Apontamentos por Ticket (052), Produtividade, Consumo de Planos,
 * Movimentação Diária e os dashboards (Suporte/Onboarding).
 */
export function defaultCurrentMonthPeriod(reference: Date = new Date()): {
  from: string
  to: string
} {
  return {
    from: format(startOfMonth(reference), 'yyyy-MM-dd'),
    to: format(reference, 'yyyy-MM-dd'),
  }
}
