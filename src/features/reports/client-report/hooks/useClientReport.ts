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
import { format } from 'date-fns'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { getClientReport } from '../../shared/services/reportsService'
import type { ClientReportDto, OrigemFiltro } from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'
import { useQuery } from '@tanstack/react-query'

export type ClientReportFilters = {
  clientId: string | null
  month: string | null  // YYYY-MM
  /** 057: filtra a fonte das linhas — all (default) | ticket | projeto */
  origem: OrigemFiltro
}

/**
 * Competência (mês) default = mês corrente, no formato YYYY-MM (PeriodFilter mode="month").
 * Clearable: o usuário pode limpar para null. O relatório só é gerado quando há
 * cliente E competência — preencher a competência por padrão não torna o filtro
 * obrigatório nem dispara a query sem cliente selecionado.
 */
function defaultCurrentMonth(reference: Date = new Date()): string {
  return format(reference, 'yyyy-MM')
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
      if (!filters.clientId || !filters.month) {
        return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 }
      }
      const report = await getClientReport({
        clientId: filters.clientId,
        month: filters.month,
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
    initialFilters: { clientId: null, month: defaultCurrentMonth(), origem: 'all' },
    initialSortBy: null,
    initialSortDirection: 'desc',
    enabled: false, // começa desativado; activado abaixo quando há filtros
  })

  // Somente ativar query quando ambos os filtros obrigatórios estão preenchidos
  const hasRequiredFilters =
    table.filters.clientId !== null && table.filters.month !== null

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
      table.filters.month,
      table.filters.origem,
      table.page,
      table.pageSize,
      table.sortBy,
      table.sortDirection,
    ],
    queryFn: async () => {
      if (!table.filters.clientId || !table.filters.month) {
        throw new Error('Filtros obrigatórios ausentes')
      }
      return getClientReport({
        clientId: table.filters.clientId,
        month: table.filters.month,
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
