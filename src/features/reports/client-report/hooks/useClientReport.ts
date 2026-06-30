/**
 * Hook U5 — Relatório do Cliente.
 *
 * Usa useServerTable para gerenciar paginação/ordenação server-side.
 * `enabled`: somente quando clientId !== null && month !== null.
 *
 * NOTA: ClientReportDto não é uma PaginatedResponse<T> — o backend retorna
 * um objeto com `items` e `totalApontamentos`. Para integrar com useServerTable,
 * adaptamos a queryFn para retornar um PaginatedResponse sintético baseado nos
 * totais do DTO. A paginação dos items é enviada ao backend via params.
 */
import { useServerTable } from '../../shared/hooks/useServerTable'
import { getClientReport } from '../../shared/services/reportsService'
import { defaultCurrentMonthFullPeriod } from '../../shared/utils/defaultPeriod'
import type { ClientReportDto, OrigemFiltro } from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'
import { useQuery } from '@tanstack/react-query'

export type ClientReportFilters = {
  clientId: string | null
  /** 068: intervalo de datas (substitui a competência/mês). YYYY-MM-DD. */
  from: string | null
  to: string | null
  /** 057: filtra a fonte das linhas — all (default) | ticket | projeto */
  origem: OrigemFiltro
}

/**
 * Período default = MÊS INTEIRO corrente (1º dia → último dia), YYYY-MM-DD.
 *
 * 068: o usuário pediu data inicial = 1º dia do mês atual (startOfMonth) e
 * data final = último dia do mês atual (endOfMonth). Reusa o helper compartilhado
 * `defaultCurrentMonthFullPeriod` — diferente do default de Apontamentos, que
 * termina em "hoje".
 *
 * Clearable: o usuário pode limpar `from`/`to`. O relatório só é gerado quando há
 * cliente selecionado E o intervalo (from + to) preenchido.
 */
function defaultClientReportPeriod(reference: Date = new Date()): {
  from: string
  to: string
} {
  return defaultCurrentMonthFullPeriod(reference)
}

/**
 * Hook que encapsula o useServerTable para o relatório do cliente.
 * Também expõe o `reportData` (ClientReportDto completo) para o resumo/header.
 */
export function useClientReport() {
  const table = useServerTable<ClientReportFilters, never>({
    queryKey: 'client-report',
    // Adaptador: a queryFn do useServerTable espera PaginatedResponse<T>
    // O getClientReport retorna ClientReportDto — adaptamos abaixo
    queryFn: async (params: TableParams<ClientReportFilters>) => {
      const { filters, page, pageSize, sortBy, sortDirection } = params
      if (!filters.clientId || !filters.from || !filters.to) {
        return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 }
      }
      const report = await getClientReport({
        clientId: filters.clientId,
        from: filters.from,
        to: filters.to,
        origem: filters.origem,
        page,
        pageSize,
        sortBy: sortBy ?? undefined,
        sortDirection: sortDirection,
      })
      return {
        items: (report.items ?? []) as never[],
        totalCount: report.totalApontamentos,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(report.totalApontamentos / pageSize)),
      }
    },
    initialFilters: {
      clientId: null,
      ...defaultClientReportPeriod(),
      origem: 'all',
    },
    initialSortBy: null,
    initialSortDirection: 'desc',
    enabled: false, // começa desativado; activado abaixo quando há filtros
  })

  // Somente ativar query quando os filtros obrigatórios estão preenchidos:
  // cliente + intervalo de datas (from E to).
  const hasRequiredFilters =
    table.filters.clientId !== null &&
    table.filters.from !== null &&
    table.filters.to !== null

  // Query separada para o ClientReportDto completo (inclui totais do resumo)
  // Sincronizada com os mesmos parâmetros — enabled apenas quando há filtros
  const {
    data: reportData,
    isLoading: isReportLoading,
    isError: isReportError,
    refetch: refetchReport,
  } = useQuery<ClientReportDto>({
    queryKey: [
      'client-report-full',
      table.filters.clientId,
      table.filters.from,
      table.filters.to,
      table.filters.origem,
      table.page,
      table.pageSize,
      table.sortBy,
      table.sortDirection,
    ],
    queryFn: async () => {
      if (!table.filters.clientId || !table.filters.from || !table.filters.to) {
        throw new Error('Filtros obrigatórios ausentes')
      }
      return getClientReport({
        clientId: table.filters.clientId,
        from: table.filters.from,
        to: table.filters.to,
        origem: table.filters.origem,
        page: table.page,
        pageSize: table.pageSize,
        sortBy: table.sortBy ?? undefined,
        sortDirection: table.sortDirection,
      })
    },
    enabled: hasRequiredFilters,
  })

  return {
    // Estado de tabela
    page: table.page,
    pageSize: table.pageSize,
    sortBy: table.sortBy,
    sortDirection: table.sortDirection,
    filters: table.filters,
    setPage: table.setPage,
    setPageSize: table.setPageSize,
    setSort: table.setSort,
    setFilters: table.setFilters,
    resetFilters: table.resetFilters,

    // Dados paginados (items)
    paginatedData: reportData
      ? {
          items: reportData.items ?? [],
          totalCount: reportData.totalApontamentos,
          page: table.page,
          pageSize: table.pageSize,
          totalPages: Math.max(
            1,
            Math.ceil(reportData.totalApontamentos / table.pageSize),
          ),
        }
      : undefined,

    // Dados completos do relatório (para ClientReportHeader e PDF)
    reportData,

    // Estado de loading/error
    isLoading: isReportLoading,
    isError: isReportError,
    refetch: refetchReport,
    hasRequiredFilters,
  }
}
