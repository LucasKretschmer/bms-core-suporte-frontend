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
 *
 * Serviço / Serviço - Secundário: campos do HubSpot não disponíveis no DTO atual.
 * TODO (Manager): adicionar os campos ao ClientReportItemDto e às colunas quando disponíveis.
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
import type { ExportColumn } from '../shared/utils/exportTable'
import { getClientReport } from '../shared/services/reportsService'
import type { ClientReportItemDto, OrigemFiltro } from '../shared/types/reports'
import {
  formatDate,
  formatDateTime,
  formatSeconds,
} from '../shared/utils/formatters'
import { buildClientReportColumns } from './columns'
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
 * Colunas do export CSV/Excel — explícitas para garantir que
 * a categoria do HubSpot NUNCA apareça no arquivo exportado.
 *
 * PRIVACIDADE: esta lista é a fonte de verdade do export.
 * Nunca adicionar campos de categoria interna do HubSpot aqui.
 */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Origem', key: 'origem' },
  { header: 'Ticket / Projeto', key: 'ticket' },
  { header: 'Nome do ticket', key: 'assunto' },
  { header: 'Equipe', key: 'equipe' },
  // Serviço mapeado para categorizacaoAtendimento (campo disponível)
  // TODO (Manager): trocar pela propriedade HubSpot `servico` quando disponível no DTO
  { header: 'Serviço', key: 'servico' },
  // Serviço - Secundário: campo não disponível no DTO atual
  // TODO (Manager): trocar pela propriedade HubSpot `servico__secundario` quando disponível
  { header: 'Serviço - Secundário', key: 'servicoSecundario' },
  { header: 'Solicitante', key: 'solicitante' },
  { header: 'Atendente', key: 'atendente' },
  { header: 'Categorização do atendimento', key: 'categorizacaoAtendimento' },
  // Faturamento: 3 status seguros (nunca expõe a categoria do HubSpot)
  { header: 'Faturamento', key: 'faturamento' },
  { header: 'Abertura do chamado', key: 'aberturaChamado' },
  { header: 'Data do apontamento', key: 'dataApontamento' },
  { header: 'Tempo', key: 'tempo' },
]

/**
 * Converte ClientReportItemDto em linha para export.
 * A ausência do campo de categoria do HubSpot é garantida pelo próprio tipo do DTO.
 */
function itemToExportRow(item: ClientReportItemDto): Record<string, string | number | null> {
  const isProjeto = item.origem === 'projeto'
  return {
    // Origem (057): rótulo legível — Ticket / Projeto
    origem: isProjeto ? 'Projeto' : 'Ticket',
    // Ticket-only: #hubspotTicketId; Projeto: nome do projeto (null-safe)
    ticket: isProjeto ? (item.projetoNome ?? '—') : item.hubspotTicketId ? `#${item.hubspotTicketId}` : '—',
    // Nome do ticket (ticket) ou stage (projeto)
    assunto: isProjeto ? (item.stage ?? '—') : (item.assunto ?? '—'),
    equipe: item.equipeAtribuida ?? '—',
    // Serviço mapeado para categorizacaoAtendimento — ver TODO acima
    servico: item.categorizacaoAtendimento ?? '—',
    // Serviço - Secundário não está no DTO
    servicoSecundario: '—',
    solicitante: item.solicitante?.nome ?? '—',
    atendente: item.atendente || '—',
    // categorizacaoAtendimento = ServiceCategory interna (≠ categoria do HubSpot)
    categorizacaoAtendimento: item.categorizacaoAtendimento ?? '—',
    // faturamento = 3 status abstratos — nunca vaza categoria do HubSpot
    faturamento: item.faturamento,
    // Linhas de projeto não têm abertura de chamado
    aberturaChamado: item.aberturaDosChamado ? formatDate(item.aberturaDosChamado) : '—',
    dataApontamento: formatDateTime(item.dataApontamento),
    tempo: formatSeconds(item.totalSegundos),
  }
}

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
        EXPORT_COLUMNS,
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
        EXPORT_COLUMNS,
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
