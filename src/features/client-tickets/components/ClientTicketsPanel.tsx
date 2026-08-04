/**
 * ClientTicketsPanel — conteúdo reutilizável de "Tickets do cliente".
 *
 * Extraído de client-tickets/index.tsx para ser usado em dois contextos:
 *  - Página dedicada /relatorios/clientes/$clientId (dentro de PageWrapper).
 *  - Drawer inline na tela de Consumo de Planos (FE-5 / #11).
 *
 * Contém KPIs do topo + busca + tabela + paginação + os 3 estados de UI.
 * Sem PageWrapper/breadcrumb — quem renderiza decide o envoltório.
 *
 * listClientTickets já passa scope='all' por default (CoordenadorPlus) — nada a
 * configurar aqui. Privacidade (R5): visão interna de drill-down.
 */

import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination'
import { Input } from '../../../components/ui/Input'
import {
  MultiSelectCombobox,
  type MultiSelectOption,
} from '../../../components/ui/MultiSelectCombobox'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useToast } from '../../../components/ui/Toast'
import { KpiCard } from '../../dashboards/shared/components/KpiCard'
import { KpiCardGrid } from '../../dashboards/shared/components/KpiCardGrid'
import { ExportButtons } from '../../reports/shared/components/ExportButtons'
import { PeriodFilter } from '../../reports/shared/components/PeriodFilter'
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../../reports/shared/utils/exportTable'
import {
  fetchAllPaginated,
  ExportLimitError,
} from '../../reports/shared/utils/fetchAllPaginated'
import { formatHours, formatPercent, formatSeconds } from '../../reports/shared/utils/formatters'
import { getPercentClass } from '../../reports/plan-consumption/columns'
import { getTicketStatuses, listTeams } from '../../reports/shared/services/reportsService'
import type { ClientTicketItemDto } from '../types/clientTickets'
import { buildClientTicketsColumns, HEADER_TEMPO_NO_PERIODO } from '../columns'
import { listClientTickets, listTicketOwners } from '../services/clientTicketsService'
import { useClientTickets } from '../hooks/useClientTickets'
import { useClientKpis } from '../hooks/useClientKpis'

/** Colunas de export — espelham a tabela visível (visão interna de drill-down). */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Ticket', key: 'ticket' },
  { header: 'Nome do ticket', key: 'assunto' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendente', key: 'owner' },
  { header: 'Status', key: 'status' },
  // 121/§4.4 — antes "Tempo do plano": o rótulo afirmava algo que a coluna não mede
  // (é o tempo TOTAL no período, todos os baldes). Mesmo rótulo da tabela visível.
  { header: HEADER_TEMPO_NO_PERIODO, key: 'tempo' },
  { header: 'Na fatura', key: 'naFatura' },
  { header: 'Apontamentos', key: 'apontamentos' },
]

/**
 * "Na fatura" no export: 3 ramos, iguais aos da coluna visível (AP-FRONTEND-021).
 *
 * `== null` cobre as DUAS formas de ausência do wire (121/F4) — o export mentiria
 * "Não" igual à tabela, e num CSV a mentira ainda sobrevive à planilha do gestor.
 */
function naFaturaTexto(entraNaFatura: boolean | null | undefined): string {
  if (entraNaFatura == null) return '—'
  return entraNaFatura ? 'Sim' : 'Não'
}

function mapTicketToExportRow(item: ClientTicketItemDto): ExportRow {
  return {
    ticket: `#${item.hubspotTicketId}`,
    assunto: item.assunto ?? '—',
    equipe: item.equipe ?? '—',
    owner: item.ownerNome ?? '—',
    status: item.status ?? '—',
    tempo: formatSeconds(item.totalSeconds),
    naFatura: naFaturaTexto(item.entraNaFatura),
    apontamentos: item.apontamentosCount,
  }
}

/**
 * 121/§4.5 (D2) — texto obrigatório do KPI "Em aberto".
 *
 * `horasEmAbertoNaoFaturadas` é um **ESTOQUE, all-time**: por definição não reage ao
 * filtro de período (soma os apontamentos de chamados com `FechadoEm == null`, sem
 * recorte). Sem esta frase na tela, o próximo QA humano reabre exatamente o relato do
 * P4 ("o filtro de data não tem efeito") — §12/R12 da arquitetura.
 *
 * Redação copiada verbatim de §4.5. AP-FRONTEND-022: não afirma prazo, limite nem
 * periodicidade, e nenhum número é digitado aqui.
 */
const KPI_EM_ABERTO_LABEL = 'Em aberto (não faturável ainda)'
const KPI_EM_ABERTO_TEXTO =
  'Total, independe do período — trabalho em chamados ainda sem data de conclusão.'

const PERCENT_SUBTEXT: Record<
  ReturnType<typeof getPercentClass>,
  'positive' | 'negative' | 'neutral'
> = {
  green: 'positive',
  yellow: 'neutral',
  red: 'negative',
  neutral: 'neutral',
}

type ClientTicketsPanelProps = {
  clientId: number
  /** Id único da tabela (persistência de ordem de colunas). */
  tableId?: string
  /** Callback ao clicar numa linha de ticket (ex.: navegar ao detalhe). */
  onTicketClick?: (row: ClientTicketItemDto) => void
  /** Período inicial (YYYY-MM-DD) — pré-preenchimento vindo da origem (095). */
  initialFrom?: string | null
  initialTo?: string | null
}

export function ClientTicketsPanel({
  clientId,
  tableId = 'client-tickets',
  onTicketClick,
  initialFrom = null,
  initialTo = null,
}: ClientTicketsPanelProps) {
  const {
    data,
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
  } = useClientTickets(clientId, { from: initialFrom, to: initialTo })

  /**
   * 121/C1 — os KPIs leem o período da MESMA fonte da tabela: `filters.from`/`filters.to`
   * do useServerTable, que é também o que a barra de filtros abaixo escreve (PeriodFilter →
   * setFilters) e o que `useClientTickets` manda a /reports/tickets. Nunca de
   * `initialFrom`/`initialTo`, que congelam o período da abertura e voltariam a divergir
   * da tabela assim que o usuário trocasse a data com o painel aberto.
   */
  const kpisQuery = useClientKpis(clientId, { from: filters.from, to: filters.to })

  // Busca textual com debounce
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setFilters({ search: value }), 300)
  }

  const columns = useMemo(() => buildClientTicketsColumns(), [])

  // Opções dos filtros multi-select (Equipe, Atendente, Status).
  // Loading/erro do fetch não quebram o painel — o controle apenas fica vazio/desabilitado.
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
    staleTime: 5 * 60 * 1000,
  })
  const ownersQuery = useQuery({
    queryKey: ['ticket-owners'],
    queryFn: listTicketOwners,
    staleTime: 5 * 60 * 1000,
  })
  const statusesQuery = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: getTicketStatuses,
    staleTime: 5 * 60 * 1000,
  })

  const teamOptions = useMemo<MultiSelectOption<number>[]>(
    () => (teamsQuery.data ?? []).map((t) => ({ value: t.id, label: t.nome })),
    [teamsQuery.data],
  )
  const ownerOptions = useMemo<MultiSelectOption<number>[]>(
    () => (ownersQuery.data ?? []).map((o) => ({ value: o.value, label: o.label })),
    [ownersQuery.data],
  )
  const statusOptions = useMemo<MultiSelectOption<string>[]>(
    () => (statusesQuery.data ?? []).map((s) => ({ value: s.value, label: s.label })),
    [statusesQuery.data],
  )

  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const kpis = kpisQuery.data
  const pctClass = getPercentClass(kpis?.percentualPlano ?? null)

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  function fetchAllForExport(): Promise<ClientTicketItemDto[]> {
    return fetchAllPaginated<ClientTicketItemDto>((page, pageSize) =>
      listClientTickets({
        clientId,
        search: filters.search || undefined,
        status: filters.status.length > 0 ? filters.status : undefined,
        teamId: filters.teamId.length > 0 ? filters.teamId : undefined,
        owner: filters.owner.length > 0 ? filters.owner : undefined,
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        sortBy: sortBy ?? undefined,
        sortDirection,
        page,
        pageSize,
      }),
    )
  }

  async function handleExportCsv() {
    if (isExporting) return
    setIsExporting(true)
    toast.info('Carregando dados para exportar…')
    try {
      const items = await fetchAllForExport()
      exportToCsv('tickets-do-cliente', EXPORT_COLUMNS, items.map(mapTicketToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch (err) {
      toast.error(
        err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    if (isExporting) return
    setIsExporting(true)
    toast.info('Carregando dados para exportar…')
    try {
      const items = await fetchAllForExport()
      await exportToXlsx('tickets-do-cliente', EXPORT_COLUMNS, items.map(mapTicketToExportRow))
      toast.success('Exportação Excel concluída.')
    } catch (err) {
      toast.error(
        err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs do topo — 3 estados: loading (skeleton nos cards), erro (ErrorState com
          retry) e vazio (valores "—" + aviso "Cliente sem plano no período"). Todos
          reagem à troca de período, porque a queryKey inclui from/to (121/C1). */}
      <section aria-label="Resumo do plano do cliente">
        {kpisQuery.isError ? (
          <ErrorState
            message="Não foi possível carregar o resumo do plano no período."
            onRetry={() => void kpisQuery.refetch()}
          />
        ) : (
          <KpiCardGrid>
            <KpiCard
              label="Plano"
              value={kpis?.nomePlano ?? '—'}
              isLoading={kpisQuery.isLoading}
            />
            <KpiCard
              label="Horas usadas"
              value={kpis ? formatHours(kpis.horasUsadas) : '—'}
              isLoading={kpisQuery.isLoading}
            />
            <KpiCard
              label="Horas restantes"
              value={kpis ? formatHours(kpis.horasRestantes) : '—'}
              isLoading={kpisQuery.isLoading}
            />
            <KpiCard
              label="Extras (estouro)"
              value={kpis ? formatHours(kpis.horasAdicionais) : '—'}
              isLoading={kpisQuery.isLoading}
              tooltipText="Horas consumidas além do plano contratado."
            />
            <KpiCard
              label="Faturável por fora"
              value={kpis ? formatHours(kpis.horasFaturaveis) : '—'}
              isLoading={kpisQuery.isLoading}
            />
            {/* 121/§4.5 — "Em aberto": estoque all-time, NÃO reage ao filtro de
                período (e a tela diz isso, no subtexto E no tooltip).
                TRÊS ramos (AP-FRONTEND-021): sem linha de plano → "—"; campo AUSENTE
                (backend sem FAT-3) → "—"; campo presente com 0 → "0h 0m". Um
                `?? 0` afirmaria "não há trabalho em aberto" enquanto o backend
                antigo estiver no ar.
                ⚠️ `== null` e não `=== undefined` (121/F4): um `decimal?` do C# manda
                `null`, e aí `formatHours(null)` escrevia "0h 0m" — afirmando ZERO onde
                o valor é DESCONHECIDO. */}
            <KpiCard
              label={KPI_EM_ABERTO_LABEL}
              value={
                kpis?.horasEmAbertoNaoFaturadas == null
                  ? '—'
                  : formatHours(kpis.horasEmAbertoNaoFaturadas)
              }
              subtext={KPI_EM_ABERTO_TEXTO}
              tooltipText={KPI_EM_ABERTO_TEXTO}
              isLoading={kpisQuery.isLoading}
            />
            <KpiCard
              label="% do plano"
              value={formatPercent(kpis?.percentualPlano ?? null)}
              /* Só depois de carregar: durante o loading o aviso apareceria ao lado do
                 skeleton afirmando "sem plano" antes de a resposta existir. */
              subtext={
                !kpisQuery.isLoading && !kpis ? 'Cliente sem plano no período' : undefined
              }
              subtextVariant={PERCENT_SUBTEXT[pctClass]}
              isLoading={kpisQuery.isLoading}
            />
          </KpiCardGrid>
        )}
      </section>

      {/* Filtros */}
      <div className="p-4 bg-card rounded-card border border-border">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Buscar"
              id={`${tableId}-search`}
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Ticket, assunto, atendente…"
              className="min-w-[220px]"
            />

            {/* Filtro de Equipe (multi-select com checkboxes) */}
            <MultiSelectCombobox<number>
              id={`${tableId}-teams`}
              label="Equipe"
              summaryLabel="Equipe"
              value={filters.teamId}
              options={teamOptions}
              onChange={(teamId) => setFilters({ teamId })}
              placeholder="Todas"
              searchable
              isLoading={teamsQuery.isLoading}
              error={teamsQuery.isError ? 'Falha ao carregar equipes.' : undefined}
              className="min-w-[180px]"
            />

            {/* Filtro de Atendente (multi-select com checkboxes, 070) */}
            <MultiSelectCombobox<number>
              id={`${tableId}-owners`}
              label="Atendente"
              summaryLabel="Atendente"
              value={filters.owner}
              options={ownerOptions}
              onChange={(owner) => setFilters({ owner })}
              placeholder="Todos"
              searchable
              isLoading={ownersQuery.isLoading}
              error={ownersQuery.isError ? 'Falha ao carregar atendentes.' : undefined}
              className="min-w-[200px]"
            />

            {/* Filtro de Status (multi-select com checkboxes) */}
            <MultiSelectCombobox<string>
              id={`${tableId}-status`}
              label="Status"
              summaryLabel="Status"
              value={filters.status}
              options={statusOptions}
              onChange={(status) => setFilters({ status })}
              placeholder="Todos"
              searchable
              isLoading={statusesQuery.isLoading}
              error={statusesQuery.isError ? 'Falha ao carregar status.' : undefined}
              className="min-w-[200px]"
            />

            {/* Filtro de período (095) — ligado a filters.from/to, clearable. */}
            <PeriodFilter
              from={filters.from}
              to={filters.to}
              onChange={(from, to) => setFilters({ from, to })}
            />
          </div>
          {!isEmpty && (
            <ExportButtons
              onExportCsv={() => void handleExportCsv()}
              onExportXlsx={() => void handleExportXlsx()}
              isExporting={isExporting}
            />
          )}
        </div>
      </div>

      {/* Estados de UI */}
      {isLoading && (
        <div className="bg-card rounded-card border border-border p-6">
          <Skeleton lines={8} />
        </div>
      )}
      {!isLoading && isError && <ErrorState onRetry={() => void refetch()} />}
      {!isLoading && !isError && isEmpty && (
        <EmptyState message="Nenhum ticket encontrado para este cliente no período." />
      )}
      {!isLoading && !isError && !isEmpty && (
        <div className="bg-card rounded-card border border-border overflow-hidden">
          <DataTable<ClientTicketItemDto>
            tableId={tableId}
            columns={columns}
            data={data?.items ?? []}
            sortState={{ sortBy, sortDirection }}
            onSort={setSort}
            onRowClick={onTicketClick}
            isClickable={Boolean(onTicketClick)}
          />
          {data && (
            <div className="px-5 border-t border-border">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                totalCount={data.totalCount}
                totalPages={data.totalPages}
                pageSizeOptions={[25, 50, 100, 200]}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
