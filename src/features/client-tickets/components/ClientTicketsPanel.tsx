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
import { InfoIcon } from '../../../components/ui/InfoIcon'
import { Switch } from '../../../components/ui/Switch'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useToast } from '../../../components/ui/Toast'
import { KpiCard } from '../../dashboards/shared/components/KpiCard'
import { KpiCardGrid } from '../../dashboards/shared/components/KpiCardGrid'
import { ExportButtons } from '../../reports/shared/components/ExportButtons'
import { PeriodFilter } from '../../reports/shared/components/PeriodFilter'
import {
  durationCell,
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../../reports/shared/utils/exportTable'
import {
  fetchAllPaginated,
  ExportLimitError,
} from '../../reports/shared/utils/fetchAllPaginated'
import { formatDate, formatHours, formatPercent } from '../../reports/shared/utils/formatters'
import {
  HEADER_BALDE_ANALISE,
  HEADER_BALDE_FATURADO,
  HEADER_BALDE_PLANO,
  HEADER_CONCLUIDO_EM,
  TEXTO_APENAS_FATURA_INFO,
  TEXTO_APENAS_FATURA_LABEL,
  TEXTO_DIVERGENCIA_KPI_TABELA,
  TOOLTIP_KPI_HORAS_ADICIONAIS,
  TOOLTIP_KPI_HORAS_FATURAVEIS,
  TOOLTIP_KPI_HORAS_RESTANTES,
  TOOLTIP_KPI_HORAS_USADAS,
  textoPeriodoDoDetalhe,
} from '../../reports/shared/utils/competenciaTexts'
import { resolverPeriodoPadrao } from '../../reports/shared/utils/periodoPadrao'
import { getPercentClass } from '../../reports/plan-consumption/columns'
import { getTicketStatuses, listTeams } from '../../reports/shared/services/reportsService'
import type { ClientTicketItemDto } from '../types/clientTickets'
import { buildClientTicketsColumns, HEADER_TEMPO_NO_PERIODO } from '../columns'
import { listClientTickets, listTicketOwners } from '../services/clientTicketsService'
import { useClientTickets } from '../hooks/useClientTickets'
import { useClientKpis } from '../hooks/useClientKpis'

/**
 * Colunas de export — espelham a tabela visível (visão interna de drill-down).
 *
 * ⚠️ AP-FRONTEND-028: o export é a MAIS grave das quatro superfícies do mesmo campo — tela
 * errada o gestor recarrega, planilha errada ele encaminha. Toda coluna nova da tabela entra
 * aqui no mesmo commit; a ORDEM espelha a da tabela para que a planilha se leia igual à tela.
 *
 * 123/FAT-1 — quatro colunas novas: "Concluído em" (a data que decide a competência) e os
 * três baldes de fatura do chamado. É a lacuna literal do relato B2 ("para a extração de
 * relatório com informações corretas"): sem os baldes, a planilha do detalhe não fecha com a
 * linha da tela-mãe, porque "Tempo no período" é outra janela.
 *
 * 134 — as QUATRO colunas de duração desta superfície ("Tempo no período" + os 3 baldes)
 * saem `type: 'duration'`: a célula leva SEGUNDOS crus e quem formata é o núcleo do export
 * (`H:mm:ss` no CSV, número + `[h]:mm:ss` no XLSX), para que o gestor consiga somar na
 * planilha. Os KPIs e a tabela da TELA não mudam — continuam em `formatHours`/`baldeTexto`.
 * ⚠️ Ausência (`null` ou chave que não veio) ⇒ célula VAZIA, nunca `0` e nunca "—": é a
 * mentira que `AP-FRONTEND-028` documenta nesta própria tela (ver o comentário do cartão
 * "Em aberto", abaixo — `formatHours(null)` escrevia "0h 0m", afirmando ZERO onde o valor é
 * DESCONHECIDO). O guard `== null` mora dentro de `durationCell`, uma vez só.
 */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Ticket', key: 'ticket' },
  { header: 'Nome do ticket', key: 'assunto' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendente', key: 'owner' },
  { header: 'Status', key: 'status' },
  // 121/§4.4 — antes "Tempo do plano": o rótulo afirmava algo que a coluna não mede
  // (é o tempo TOTAL no período, todos os baldes). Mesmo rótulo da tabela visível.
  { header: HEADER_TEMPO_NO_PERIODO, key: 'tempo', type: 'duration' },
  { header: 'Apontamentos', key: 'apontamentos' },
  { header: HEADER_CONCLUIDO_EM, key: 'concluidoEm' },
  { header: 'Na fatura', key: 'naFatura' },
  { header: HEADER_BALDE_PLANO, key: 'baldePlano', type: 'duration' },
  { header: HEADER_BALDE_FATURADO, key: 'baldeFaturado', type: 'duration' },
  { header: HEADER_BALDE_ANALISE, key: 'baldeAnalise', type: 'duration' },
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

/**
 * "Concluído em" no export: MESMO guard `== null` da coluna visível (AP-FRONTEND-028).
 * Chamado sem data de conclusão vem com a chave AUSENTE (o backend serializa com
 * `WhenWritingNull`), e um `formatDate(undefined)` colocaria "Invalid Date" na planilha.
 */
function concluidoEmTexto(fechadoEm: string | null | undefined): string {
  if (fechadoEm == null) return '—'
  return formatDate(fechadoEm)
}

function mapTicketToExportRow(item: ClientTicketItemDto): ExportRow {
  return {
    ticket: `#${item.hubspotTicketId}`,
    assunto: item.assunto ?? '—',
    equipe: item.equipe ?? '—',
    owner: item.ownerNome ?? '—',
    status: item.status ?? '—',
    tempo: durationCell(item.totalSeconds),
    apontamentos: item.apontamentosCount,
    concluidoEm: concluidoEmTexto(item.fechadoEm),
    naFatura: naFaturaTexto(item.entraNaFatura),
    // 134 — o export deixa de chamar `baldeTexto` (que segue sendo a formatação da
    // COLUNA VISÍVEL, em `columns.tsx`) e passa os segundos crus por `durationCell`.
    // O guard `== null` continua existindo exatamente uma vez, agora dentro do helper.
    baldePlano: durationCell(item.faturaPlanoSegundos),
    baldeFaturado: durationCell(item.faturaFaturadoSegundos),
    baldeAnalise: durationCell(item.faturaAnaliseSegundos),
  }
}

// 🔴 132/F3 — aqui vivia a nota que explicava por que o rótulo do KPI "Em aberto" morava em
// `competenciaTexts.ts`: `textoPeriodoDoDetalhe` NOMEAVA aquele cartão como a exceção da frase
// de período (123/FE-FIX3, ressalva `F-2`), e as duas pontas tinham de sair da mesma constante.
//
// O cartão saiu na 132/F2 e a exceção saiu da frase no mesmo commit — a nota ficou sem sujeito
// e descrevia um acoplamento que já não existe. O mecanismo, no entanto, VALE: toda copy deste
// painel continua em `competenciaTexts.ts`, e é de lá que sai também o tooltip do cartão
// "Extras (estouro)", que até a 132/F3 estava digitado inline logo abaixo (e ficou falso quando
// o plano passou a ter crédito somado).

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
   *
   * 123/FE-PER (D-2) — e passam pelo MESMO resolvedor de default da tabela
   * (`resolverPeriodoPadrao`). Antes, campo em branco significava coisas OPOSTAS nas duas
   * rotas: `/metrics/plan-consumption` caía no mês corrente e `/reports/tickets` ficava sem
   * restrição nenhuma — duas janelas de tempo na mesma tela, sem aviso. Agora as duas
   * metades recebem a mesma janela, sempre explícita, e a tela imprime qual é (§ abaixo).
   */
  const periodo = useMemo(
    () => resolverPeriodoPadrao({ from: filters.from, to: filters.to }),
    [filters.from, filters.to],
  )
  const kpisQuery = useClientKpis(clientId, periodo)

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

  /** Id do toggle de fatura — `<label htmlFor>` precisa casar com o `id` do Switch. */
  const apenasFaturaId = `${tableId}-apenas-fatura`

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
        // Mesma janela resolvida da tela (D-2): a planilha não pode sair com o range aberto
        // enquanto a tabela mostra o mês atual.
        from: periodo.from,
        to: periodo.to,
        // O export sai com o MESMO recorte da tela — senão a planilha responde a outra
        // pergunta que a tabela de onde o usuário clicou "Exportar".
        apenasFatura: filters.apenasFatura || undefined,
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
            {/* 123/FAT-1 · 🔴 132/D1 — os KPIs vêm da MESMA linha de
                /metrics/plan-consumption da tela-mãe (getClientKpis), logo recortam pela
                DATA DO APONTAMENTO (era a data de conclusão do chamado até a 132) e herdam
                o plano EFETIVO, com o crédito da competência já somado. Sem o tooltip,
                "Horas usadas = 0h 0m" com apontamentos visíveis na tabela logo abaixo parece
                defeito — é o relato B2 literal. */}
            <KpiCard
              label="Horas usadas"
              value={kpis ? formatHours(kpis.horasUsadas) : '—'}
              tooltipText={TOOLTIP_KPI_HORAS_USADAS}
              isLoading={kpisQuery.isLoading}
            />
            <KpiCard
              label="Horas restantes"
              value={kpis ? formatHours(kpis.horasRestantes) : '—'}
              tooltipText={TOOLTIP_KPI_HORAS_RESTANTES}
              isLoading={kpisQuery.isLoading}
            />
            {/* 🔴 132/F3 — o tooltip deste cartão estava DIGITADO INLINE e dizia "além do
                plano contratado". Com o plano efetivo (D11) o excedente é medido contra
                contrato + crédito, então "contratado" passou a nomear o divisor errado — e,
                digitado aqui, o texto escapava de todos os detectores de
                `competenciaTexts.test.ts` (AP-FRONTEND-022). Agora sai da mesma constante que
                a coluna "Horas Adicionais" do Consumo de Planos, que é o MESMO número. */}
            <KpiCard
              label="Extras (estouro)"
              value={kpis ? formatHours(kpis.horasAdicionais) : '—'}
              isLoading={kpisQuery.isLoading}
              tooltipText={TOOLTIP_KPI_HORAS_ADICIONAIS}
            />
            <KpiCard
              label="Faturável por fora"
              value={kpis ? formatHours(kpis.horasFaturaveis) : '—'}
              tooltipText={TOOLTIP_KPI_HORAS_FATURAVEIS}
              isLoading={kpisQuery.isLoading}
            />
            {/* 🔴 132/F2 (D7) — aqui vivia o 7º cartão, "Em aberto (não faturável
                ainda)", alimentado por `kpis.horasEmAbertoNaoFaturadas`. Ele era o
                SEGUNDO consumidor do campo (o 1º é o Consumo de Planos, que compartilha
                a MESMA linha via `getClientKpis`), e o campo **saiu do wire** de
                `/metrics/plan-consumption` na 132/B1+B2.

                O conceito acabou, não foi só o cartão: com `TimeEntry.InicioEm` como
                competência (132/D1), a hora é faturada no mês em que foi APONTADA —
                chamado aberto ou fechado. "Trabalho em aberto, fora de qualquer fatura"
                deixou de existir como conjunto; o que antes ficava nesse limbo agora
                aparece nos cartões acima, na competência do apontamento.

                ⚠️ A grade caiu de 7 para 6 cartões. Se você veio devolver o cartão:
                ele não tem fonte de dado. */}
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

        {/* 123/FAT-1 + 123/FE-PER · 🔴 reescrito por 132/F3 — a tela deixa de esconder:
              0. (D-2) QUAL período está em uso, inclusive quando ele veio do padrão da tela
                 (mês atual). Default invisível é defeito de comunicação: foi ele que fez o
                 usuário concluir que a tela estava errada.
              1. o que cada número MEDE — os cartões medem consumo do plano (só chamado, sem
                 as horas de cobrar por fora e sem as isentas); a coluna "Tempo no período"
                 mede todo o tempo apontado.
            🔴 O que NÃO se afirma mais aqui: que as duas metades recortam por datas
            diferentes. Depois da 132/D1 as duas recortam pela data do apontamento
            (`⟪132 JANELA-OPERACIONAL⟫` × `⟪132 JANELA-COMPETENCIA⟫`) — e também não se
            afirma o contrário ("agora batem"), porque o que cada uma mede continua
            diferente. As duas janelas seguem separadas no backend de propósito (PRD §8.1);
            unificá-las é decisão de produto (DP-7), ainda aberta. */}
        <p className="mt-2 max-w-[100ch] text-xs text-muted">
          {textoPeriodoDoDetalhe({ from: filters.from, to: filters.to })}{' '}
          {TEXTO_DIVERGENCIA_KPI_TABELA}
        </p>
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

            {/* 123/FAT-1 — liga `apenasFatura`, que existia implementado e testado no
                backend (`ReportsController.cs:254`) e não tinha NENHUM chamador no painel.
                Nasce DESLIGADO: o padrão continua sendo a visão de conferência, com os
                chamados em aberto na lista (instrução explícita do usuário). Ligado, o
                usuário reconcilia esta lista com a linha da tela-mãe. */}
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id={apenasFaturaId}
                checked={filters.apenasFatura}
                onChange={(apenasFatura) => setFilters({ apenasFatura })}
                label={TEXTO_APENAS_FATURA_LABEL}
                hideLabel={false}
              />
              <label
                htmlFor={apenasFaturaId}
                className="text-xs text-foreground cursor-pointer"
              >
                {TEXTO_APENAS_FATURA_LABEL}
              </label>
              <InfoIcon tooltip={TEXTO_APENAS_FATURA_INFO} />
            </div>
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
        /* O vazio significa coisas diferentes com e sem o recorte de fatura, e um texto
           só faria o usuário concluir que o cliente não tem chamado nenhum. */
        <EmptyState
          message={
            filters.apenasFatura
              ? 'Nenhum chamado deste cliente foi concluído dentro do período filtrado, então nada dele entra nesta fatura. Desligue "Só o que entra na fatura do período" para ver também os chamados em aberto.'
              : 'Nenhum ticket encontrado para este cliente no período.'
          }
        />
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
