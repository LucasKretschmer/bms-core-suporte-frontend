import type { UnmatchedPlanDto } from '../types/supportPlan'

/**
 * Textos do card "Planos do HubSpot sem correspondência".
 *
 * Vive fora do componente por duas razões: o `react-refresh/only-export-components`
 * reprova arquivo de componente que também exporta função (erro de lint, não estilo), e
 * texto que **afirma quantidade** é testável isoladamente (AP-FRONTEND-022). Mesmo
 * arranjo de `features/reports/plan-consumption/billingExceptionsTexts.ts`.
 */

export const TITULO_UNMATCHED = 'Planos do HubSpot sem correspondência'

/**
 * Resumo em uma frase. Os dois números vêm da **resposta**, nunca digitados: o total de
 * valores é o tamanho da lista e o total de clientes é a soma de `clientesAfetados`.
 */
export function textoResumoUnmatched(itens: readonly UnmatchedPlanDto[]): string {
  const valores = itens.length
  const clientes = itens.reduce((total, item) => total + item.clientesAfetados, 0)
  const parteValores =
    valores === 1
      ? '1 valor de plano vindo do HubSpot não corresponde'
      : `${valores} valores de plano vindos do HubSpot não correspondem`
  const parteClientes = clientes === 1 ? '1 cliente afetado' : `${clientes} clientes afetados`
  return `${parteValores} a nenhum plano cadastrado — ${parteClientes}.`
}
