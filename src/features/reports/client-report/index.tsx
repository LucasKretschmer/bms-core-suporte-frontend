/**
 * Página U5 — Relatório do Cliente.
 *
 * PRIVACIDADE (regra central):
 *   - A categoria do chamado do HubSpot (ex: "Problema - Invoicy") NUNCA aparece
 *     nesta tela, no export CSV/Excel, nem no PDF.
 *   - O DTO ClientReportItemDto não contém esse campo — garantia em tempo de tipo.
 *   - A coluna "Faturamento" usa apenas os 3 status: Plano de Suporte / Faturado / Não faturado.
 *   - A coluna "Categorização do atendimento" é a ServiceCategory interna (campo diferente).
 *
 * Filtros obrigatórios: Cliente (combobox assíncrono) + intervalo de datas
 * (data inicial / data final — 068). Default ao abrir: 1º dia → último dia do mês
 * atual. Enquanto não preenchidos, exibe EmptyState com instrução ao usuário.
 *
 * Linhas clicáveis: ao clicar numa linha, navega para o detalhe interno do ticket
 * (/relatorios/tickets/$ticketId). O detalhe é uso interno — a privacidade do cliente
 * (categoria HubSpot) permanece preservada nesta tela/PDF/export (R5).
 */

import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination'
import { ReportPageLayout } from '../../../components/layout/ReportPageLayout'
import { ClientCombobox } from '../shared/components/ClientCombobox'
import { ExportButtons } from '../shared/components/ExportButtons'
import { PeriodFilter } from '../shared/components/PeriodFilter'
import { Combobox } from '../../../components/ui/Combobox'
import { exportToCsv, exportToXlsx } from '../shared/utils/exportTable'
import { getClientReport } from '../shared/services/reportsService'
import type { ClientReportItemDto, OrigemFiltro } from '../shared/types/reports'
import { CompetenciaNota } from '../shared/components/CompetenciaNota'
import { buildClientReportColumns } from './columns'
import {
  CLIENT_REPORT_EXPORT_COLUMNS,
  itemToExportRow,
} from './utils/clientReportExportRows'
import { ClientReportHeader } from './components/ClientReportHeader'
import { ClientReportPdf } from './components/ClientReportPdf'
import { useClientReport } from './hooks/useClientReport'

/** Chave única para persistência da ordem das colunas */
const TABLE_ID = 'client-report'

/** Opções do filtro de Origem (057) — visão por cliente combinada */
const ORIGEM_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'projeto', label: 'Projeto' },
]

/**
 * Página principal U5 — Relatório do Cliente.
 * Restrita a CoordenadorPlus (guarda de rota em routes/_auth/relatorios/cliente.tsx).
 */
export default function ClientReportPage() {
  const navigate = useNavigate()
  const {
    reportData,
    paginatedData,
    isLoading,
    isError,
    refetch,
    sortBy,
    sortDirection,
    filters,
    setPage,
    setPageSize,
    setSort,
    setFilters,
    hasRequiredFilters,
  } = useClientReport()

  // Estado de export
  const [isExporting, setIsExporting] = useState(false)

  /**
   * Busca TODOS os apontamentos (todas as páginas) — nunca só a página visível.
   * Base tanto do export (CSV/Excel) quanto do PDF (detalhado/consolidado).
   */
  const fetchAllItems = useCallback(async (): Promise<ClientReportItemDto[]> => {
    if (!filters.clientId || !filters.from || !filters.to) return []

    const PAGE_SIZE = 200
    const allItems: ClientReportItemDto[] = []
    let currentPage = 1
    let totalPages = 1

    do {
      const result = await getClientReport({
        clientId: filters.clientId,
        from: filters.from,
        to: filters.to,
        origem: filters.origem,
        page: currentPage,
        pageSize: PAGE_SIZE,
        sortBy: sortBy ?? undefined,
        sortDirection,
      })
      totalPages = Math.max(
        1,
        Math.ceil(result.totalApontamentos / PAGE_SIZE),
      )
      ;(result.items ?? []).forEach((item) => {
        allItems.push(item)
      })
      currentPage++
    } while (currentPage <= totalPages)

    return allItems
  }, [filters.clientId, filters.from, filters.to, filters.origem, sortBy, sortDirection])

  /** Linhas de export (CSV/Excel) — deriva do conjunto completo de itens. */
  const fetchAllForExport = useCallback(async () => {
    const items = await fetchAllItems()
    return items.map(itemToExportRow)
  }, [fetchAllItems])

  /** Sufixo do nome de arquivo de export: intervalo de datas (from_to) ou 'periodo'. */
  const periodSuffix =
    filters.from && filters.to ? `${filters.from}_${filters.to}` : 'periodo'

  async function handleExportCsv() {
    setIsExporting(true)
    try {
      const rows = await fetchAllForExport()
      const clientName =
        reportData?.client.nomeFantasia ??
        reportData?.client.razaoSocial ??
        'cliente'
      exportToCsv(
        `relatorio-cliente-${clientName}-${periodSuffix}`.toLowerCase().replace(/\s+/g, '-'),
        CLIENT_REPORT_EXPORT_COLUMNS,
        rows,
      )
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    setIsExporting(true)
    try {
      const rows = await fetchAllForExport()
      const clientName =
        reportData?.client.nomeFantasia ??
        reportData?.client.razaoSocial ??
        'cliente'
      await exportToXlsx(
        `relatorio-cliente-${clientName}-${periodSuffix}`.toLowerCase().replace(/\s+/g, '-'),
        CLIENT_REPORT_EXPORT_COLUMNS,
        rows,
      )
    } finally {
      setIsExporting(false)
    }
  }

  /**
   * Ao clicar numa linha de TICKET, navega para o detalhe interno do ticket.
   * Linhas de PROJETO não têm detalhe de ticket (057) — clique é ignorado.
   */
  const handleRowClick = useCallback(
    (row: ClientReportItemDto) => {
      if (row.origem !== 'ticket' || row.ticketId == null) return
      void navigate({
        to: '/relatorios/tickets/$ticketId',
        params: { ticketId: String(row.ticketId) },
        search: { from: 'cliente', clientId: filters.clientId ?? undefined },
      })
    },
    [navigate, filters.clientId],
  )

  // Colunas da tabela — com linha clicável (cursor-pointer, hover por sombra)
  const columns = buildClientReportColumns({
    rowIsClickable: true,
  })

  const items = paginatedData?.items ?? []
  const isEmpty =
    !isLoading && !isError && hasRequiredFilters && items.length === 0
  const isFiltersEmpty = !hasRequiredFilters

  // Nome do arquivo para PDF
  const pdfFilename = [
    'relatorio-cliente',
    reportData?.client.nomeFantasia ??
      reportData?.client.razaoSocial ??
      'cliente',
    periodSuffix,
  ]
    .join('-')
    .toLowerCase()
    .replace(/\s+/g, '-')

  return (
    <ReportPageLayout
      title="Relatório do Cliente"
      breadcrumbItems={[
        { label: 'Relatórios' },
        { label: 'Relatório do Cliente' },
      ]}
      filters={
        <div className="flex flex-wrap items-end gap-3">
          {/* 068: campo Cliente 2x mais largo (140px → 280px) que os demais filtros. */}
          <ClientCombobox
            value={filters.clientId}
            onChange={(clientId) => setFilters({ clientId })}
            required
            label="Cliente *"
            showCnpj={false}
            className="min-w-[280px]"
          />
          {/* 068: competência (mês) substituída por intervalo data inicial/final. */}
          <PeriodFilter
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => setFilters({ from, to })}
            mode="date"
            labelFrom="Data inicial *"
            labelTo="Data final *"
          />
          <Combobox
            label="Origem"
            id="client-report-origem"
            value={filters.origem}
            options={ORIGEM_OPTIONS}
            onChange={(v) => setFilters({ origem: (v || 'all') as OrigemFiltro })}
            placeholder="Todos"
            className="min-w-[140px]"
          />
        </div>
      }
      exportActions={
        hasRequiredFilters && reportData ? (
          <div className="flex items-center gap-2">
            <ExportButtons
              onExportCsv={() => void handleExportCsv()}
              onExportXlsx={() => void handleExportXlsx()}
              isExporting={isExporting}
            />
            <ClientReportPdf
              report={reportData}
              filename={pdfFilename}
              fetchAllItems={fetchAllItems}
            />
          </div>
        ) : null
      }
      /* 123/FAT-1 (lacuna G5/G9) — esta tela é uma tela de FATURA e não dizia por qual data
         apurava. Vai no slot `banner` porque ele fica FORA da máquina de estados: a
         explicação precisa estar visível justamente quando a tabela volta vazia, que é
         quando o usuário conclui que o filtro perdeu as horas dele.
         Só aparece depois de cliente + datas escolhidos — antes disso não há recorte a
         explicar (o próprio EmptyState pede os filtros). */
      banner={
        hasRequiredFilters ? (
          <CompetenciaNota
            from={filters.from}
            to={filters.to}
            /* A tela mistura ticket (por conclusão) e projeto (por apontamento) numa
               listagem só — `ReportQueryRepository.cs:114-118` × `:150-153`. Com o filtro
               de origem em "Ticket" a exceção de projeto não se aplica e seria ruído. */
            incluiProjeto={filters.origem !== 'ticket'}
          />
        ) : undefined
      }
      isLoading={isLoading && hasRequiredFilters}
      isError={isError}
      isEmpty={isEmpty || isFiltersEmpty}
      onRetry={refetch}
      emptyMessage={
        isFiltersEmpty
          ? 'Selecione um cliente e um intervalo de datas para gerar o relatório.'
          : 'Nenhum apontamento encontrado para este cliente no período.'
      }
    >
      {/* Resumo do relatório (acima da tabela) */}
      {reportData && <ClientReportHeader report={reportData} />}

      {/* Tabela de apontamentos */}
      <DataTable
        tableId={TABLE_ID}
        columns={columns}
        data={items}
        sortState={{ sortBy, sortDirection }}
        onSort={setSort}
        onRowClick={handleRowClick}
        isClickable
      />

      {/* Paginação */}
      {paginatedData && paginatedData.totalPages > 0 && (
        <div className="px-5 border-t border-border">
          <Pagination
            page={paginatedData.page}
            pageSize={paginatedData.pageSize}
            totalCount={paginatedData.totalCount}
            totalPages={paginatedData.totalPages}
            pageSizeOptions={[25, 50, 100, 200]}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </ReportPageLayout>
  )
}
