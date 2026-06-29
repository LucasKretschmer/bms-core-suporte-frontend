/**
 * Hook de drill-down da família TICKET (016) — retrocompatibilidade.
 *
 * É um alias tipado de useMetricDrill<TicketRowDto>: toda a lógica (enabled:false até
 * abrir, paginação/ordenação locais, queryKey com filtros da tela) vive no hook genérico.
 * Mantido para não quebrar os call-sites/tests da família ticket (016 1ª onda).
 */

import { useMetricDrill, type UseMetricDrillReturn } from './useMetricDrill'
import type {
  DrillSpec,
  MetricsBaseParams,
  TicketRowDto,
} from '../types/metrics'

export type UseTicketDrillReturn = UseMetricDrillReturn<TicketRowDto>

export function useTicketDrill(
  activeDrill: DrillSpec | null,
  baseParams: MetricsBaseParams,
): UseTicketDrillReturn {
  return useMetricDrill<TicketRowDto>(activeDrill, baseParams)
}
