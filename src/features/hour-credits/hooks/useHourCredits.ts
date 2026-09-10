import { useServerTable } from '../../reports/shared/hooks/useServerTable'
import { listHourCredits } from '../services/hourCreditsService'
import type { HourCreditDto } from '../types/hourCredit'

/**
 * Prefixo da chave de cache dos créditos.
 *
 * ⚠️ `useServerTable` recebe o **prefixo como string** e monta o array
 * (`[queryKey, page, pageSize, sortBy, sortDirection, filters]`) lá dentro, então o
 * detector estático de `queryKeyRegistry` não resolve esta chave — ela entra
 * **nominalmente** em `NAO_RESOLVIDAS_ACEITAS`, como as 7 irmãs. Exportada para que a
 * invalidação das mutations parta da MESMA fonte.
 */
export const HOUR_CREDITS_QUERY_KEY = 'hour-credits'

export type HourCreditsFilters = {
  clientId: number | null
  /** `"YYYY-MM"` — filtro de competência de vigência. */
  competencia: string | null
  /** Vocabulário do servidor; vazio = sem filtro. */
  status: string[]
  origem: string | null
  search: string
}

export const FILTROS_INICIAIS_DE_CREDITOS: HourCreditsFilters = {
  clientId: null,
  competencia: null,
  status: [],
  origem: null,
  search: '',
}

/**
 * Tabela server-side de Créditos de Horas (132/F5).
 *
 * Ordenação default `criadoem desc` — é a whitelist do backend
 * (`analise-backend.md` §7.2), e valor fora dela devolve `400` na borda. Por isso as
 * colunas ordenáveis usam exatamente `criadoem`, `horas`, `competencia`,
 * `competenciaorigem`, `clientenome` e `origem`; `status` fica **fora** de propósito (é
 * derivado, e o analista de backend recomendou não inventar ordem para ele).
 */
export function useHourCredits() {
  return useServerTable<HourCreditsFilters, HourCreditDto>({
    queryKey: HOUR_CREDITS_QUERY_KEY,
    queryFn: ({ page, pageSize, sortBy, sortDirection, filters }) =>
      listHourCredits({
        clientId: filters.clientId,
        competencia: filters.competencia,
        status: filters.status,
        origem: filters.origem,
        search: filters.search,
        sortBy,
        sortDirection,
        page,
        pageSize,
      }),
    initialFilters: FILTROS_INICIAIS_DE_CREDITOS,
    initialSortBy: 'criadoem',
    initialSortDirection: 'desc',
  })
}
