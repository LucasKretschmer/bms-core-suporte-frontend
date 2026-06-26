/**
 * Tipos da feature "Tickets do cliente" (F2 — drill-down de Consumo de Planos).
 *
 * A tabela reusa o endpoint /api/v1/reports/tickets (B1) filtrado por clientId →
 * mesmo DTO TicketReportItemDto. Os KPIs do topo vêm da linha do cliente em
 * /api/v1/metrics/plan-consumption (PlanConsumptionItemDto).
 *
 * Nunca usar `any`.
 */

import type {
  PlanConsumptionItemDto,
  TicketReportItemDto,
} from '../../reports/shared/types/reports'

/** Item da tabela de tickets do cliente — reuso direto do DTO do relatório de tickets. */
export type ClientTicketItemDto = TicketReportItemDto

/** KPIs do topo — derivados da linha do cliente em plan-consumption. */
export type ClientKpis = PlanConsumptionItemDto
