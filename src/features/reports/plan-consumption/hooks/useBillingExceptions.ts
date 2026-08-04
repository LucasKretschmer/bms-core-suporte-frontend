import { useQuery } from '@tanstack/react-query'
import {
  getBillingExceptionsSummary,
  listBillingExceptions,
} from '../../shared/services/reportsService'
import type {
  BillingExceptionItemDto,
  BillingExceptionsSummaryDto,
  BillingExceptionTipo,
} from '../../shared/types/reports'
import type { PaginatedResponse } from '../../../../types/api'
import {
  BILLING_EXCEPTIONS_PAGE_SIZE,
  BILLING_EXCEPTIONS_SORT_BY,
  BILLING_EXCEPTIONS_TIPO_INICIAL,
} from '../billingExceptions'

export type UseBillingExceptionsArgs = {
  /** Período da tela (YYYY-MM-DD) — filtra por EXISTÊNCIA de apontamento na janela. */
  from: string | null
  to: string | null
  /** F-15 — qual seção. Default `anomalia` (a acionável). */
  tipo?: BillingExceptionTipo
  /** `true` ⇒ `from`/`to` NÃO são enviados e o relatório volta todas as exceções. */
  ignorarPeriodo?: boolean
  page?: number
  pageSize?: number
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  /** Permite adiar a requisição (ex.: modal fechado). Default: true. */
  enabled?: boolean
}

/**
 * 121/A2 — exceções de faturamento (chamado em estágio fechado sem data de conclusão).
 *
 * ⚠️ `queryKey` inclui **todo** parâmetro que muda o resultado (período efetivo,
 * paginação e ordenação). Foi exatamente o defeito da unidade WEB-1: com o período
 * fora da chave, o TanStack Query serve o resultado do filtro anterior e o bug
 * reaparece em forma de cache — sem erro nenhum na tela.
 *
 * `ignorarPeriodo` entra na chave **além** do período efetivo: os dois carregam a
 * mesma informação hoje, mas a intenção do usuário é o que o modal alterna, e é ela
 * que precisa aparecer na chave se um dia `from`/`to` passarem a ser enviados junto.
 *
 * ⚠️ NÃO existe cache hit ao abrir o modal (121/F3 — corrigido em 04/08/2026). §5.3 da
 * arquitetura previa que o card e o modal compartilhassem esta query, e o comentário
 * anterior AFIRMAVA isso. Deixou de valer com a decisão F-15: o card passou a usar
 * `useBillingExceptionsSummary`, que é **outro endpoint** (`/summary`) e outra
 * `queryKey`, porque precisa dos totais exatos das DUAS seções ao mesmo tempo — coisa
 * que o envelope paginado não dá. Logo, abrir o modal é **sempre** uma requisição nova,
 * a primeira de `listBillingExceptions` no ciclo. Desvio consciente de §5.3, não bug;
 * quem revogar ou restaurar o requisito atualiza este comentário junto.
 */
export function useBillingExceptions({
  from,
  to,
  tipo = BILLING_EXCEPTIONS_TIPO_INICIAL,
  ignorarPeriodo = false,
  page = 1,
  pageSize = BILLING_EXCEPTIONS_PAGE_SIZE,
  sortBy = BILLING_EXCEPTIONS_SORT_BY,
  sortDirection = 'desc',
  enabled = true,
}: UseBillingExceptionsArgs) {
  // Ramo explícito de "ignorar período": os params são OMITIDOS (nunca string vazia —
  // `DateTime?` no controller rejeitaria com 400).
  const periodoEfetivo = ignorarPeriodo
    ? { from: null, to: null }
    : { from, to }

  return useQuery<PaginatedResponse<BillingExceptionItemDto>>({
    queryKey: [
      'billing-exceptions',
      {
        tipo,
        from: periodoEfetivo.from,
        to: periodoEfetivo.to,
        ignorarPeriodo,
        page,
        pageSize,
        sortBy,
        sortDirection,
      },
    ],
    queryFn: () =>
      listBillingExceptions({
        tipo,
        from: periodoEfetivo.from,
        to: periodoEfetivo.to,
        sortBy,
        sortDirection,
        page,
        pageSize,
      }),
    enabled,
  })
}

/**
 * F-15 — agregados das DUAS seções, para o card.
 *
 * Query separada da listagem de propósito: o card precisa dos **totais exatos** das
 * duas seções ao mesmo tempo (e da contagem de não classificados), e o envelope
 * paginado não tem como dar isso. Somar a página e chamar de total seria escrever um
 * número falso na tela.
 *
 * ⚠️ Endpoint proposto por esta unidade, ainda inexistente (requisito da FAT-4).
 */
export function useBillingExceptionsSummary({
  from,
  to,
  enabled = true,
}: {
  from: string | null
  to: string | null
  enabled?: boolean
}) {
  return useQuery<BillingExceptionsSummaryDto>({
    // O período entra na chave: o resumo muda com o recorte de atividade.
    queryKey: ['billing-exceptions-summary', { from, to }],
    queryFn: () => getBillingExceptionsSummary({ from, to }),
    enabled,
  })
}
