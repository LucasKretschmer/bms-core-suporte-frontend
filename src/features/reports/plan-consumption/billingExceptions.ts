/**
 * 121/A2 (D2) + F-15 — constantes do relatório de exceções de faturamento.
 *
 * Duas seções, com predicados e propósitos distintos (ver
 * `BillingExceptionTipo` em `shared/types/reports.ts`):
 *   `anomalia`   → estágio fechado sem data de conclusão. EXIGE AÇÃO.
 *   `postergado` → estágio aberto sem data de conclusão. INFORMATIVO.
 */

import type { BillingExceptionTipo } from '../shared/types/reports'

/** Página default da listagem de cada seção. */
export const BILLING_EXCEPTIONS_PAGE_SIZE = 25

/** Ordenação default do backend (§5.2): maiores volumes primeiro. */
export const BILLING_EXCEPTIONS_SORT_BY = 'segundos'

/**
 * Seção aberta ao entrar no modal: a **acionável**.
 *
 * Não é preferência estética: no momento de uso (conferência antes de fechar o mês) a
 * primeira pergunta é "algo exige minha ação?". Abrir na seção informativa faria o
 * item acionável exigir um clique extra para ser descoberto — o silêncio que D2
 * combate.
 */
export const BILLING_EXCEPTIONS_TIPO_INICIAL: BillingExceptionTipo = 'anomalia'

/** Identidade do conjunto de seções — travada por teste, não mantida à mão em 2 lugares. */
export const BILLING_EXCEPTIONS_TIPOS: readonly BillingExceptionTipo[] = [
  'anomalia',
  'postergado',
]
