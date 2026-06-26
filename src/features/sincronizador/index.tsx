import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '../../components/ui/Button'
import type { ComboboxOption } from '../../components/ui/Combobox'
import { Combobox } from '../../components/ui/Combobox'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Pagination } from '../../components/ui/Pagination'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { usePermissions } from '../../hooks/usePermissions'
import { ExportButtons } from '../reports/shared/components/ExportButtons'
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../reports/shared/utils/exportTable'
import { fetchAllPaginated, ExportLimitError } from '../reports/shared/utils/fetchAllPaginated'
import { DurationLabel } from './components/DurationLabel'
import { LogsTable } from './components/LogsTable'
import { ManutencaoRegistros } from './components/ManutencaoRegistros'
import { SyncStatusBadge } from './components/SyncStatusBadge'
import { SyncTeamsButton } from './components/SyncTeamsButton'
import { listSincronizacaoLogs } from './services/sincronizadorService'
import { useSincronizadorLogs } from './hooks/useSincronizadorLogs'
import { useSincronizadorStatus } from './hooks/useSincronizadorStatus'
import { useRunSincronizador } from './hooks/useRunSincronizador'
import type { LogDto, SyncStatus } from './types/sincronizador'

const STATUS_LABEL: Record<SyncStatus, string> = {
  executando: 'Executando',
  concluido: 'Concluído',
  erro: 'Erro',
}

/** Colunas de export dos logs — espelham a LogsTable (sem JSX). */
const LOGS_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Status', key: 'status' },
  { header: 'Disparo', key: 'disparo' },
  { header: 'Iniciado em', key: 'iniciadoEm' },
  { header: 'Duração', key: 'duracao' },
  { header: 'Tickets / Projetos', key: 'contadores' },
  { header: 'Emp. / Cont.', key: 'empresas' },
  { header: 'Erro', key: 'mensagemErro' },
]

function formatDateTimeSeconds(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })
  } catch {
    return iso
  }
}

function formatDuracao(duracaoMs: number | null): string {
  if (duracaoMs === null) return '—'
  const totalSeconds = Math.round(duracaoMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`
}

function mapLogToExportRow(log: LogDto): ExportRow {
  return {
    status: STATUS_LABEL[log.status] ?? log.status,
    disparo: log.disparo === 'automatico' ? 'Automático' : 'Manual',
    iniciadoEm: formatDateTimeSeconds(log.iniciadoEm),
    duracao: formatDuracao(log.duracaoMs),
    contadores: `${log.ticketsUpserted}↑ ${log.ticketsIgnorados}↷ / ${log.projetosUpserted}↑ ${log.projetosIgnorados}↷`,
    empresas: `${log.empresasResolvidas} / ${log.contatosResolvidos}`,
    mensagemErro: log.mensagemErro ?? '—',
  }
}

const STATUS_OPTIONS: ComboboxOption[] = [
  { value: '', label: 'Todos' },
  { value: 'executando', label: 'Executando' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'erro', label: 'Erro' },
]

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return iso
  }
}

/**
 * Página de monitoramento do Sincronizador HubSpot.
 * Visível apenas para GerentePlus (GERENTE ou ADMIN).
 * Seções: Status, Log de Execuções, Equipes, Manutenção de Registros.
 */
export default function SincronizadorPage() {
  const { isGerentePlus } = usePermissions()

  const statusQuery = useSincronizadorStatus()
  const logsHook = useSincronizadorLogs()
  const runMutation = useRunSincronizador()
  const toast = useToast()
  const [isExportingLogs, setIsExportingLogs] = useState(false)

  function fetchAllLogsForExport(): Promise<LogDto[]> {
    return fetchAllPaginated<LogDto>((page, pageSize) =>
      listSincronizacaoLogs({
        page,
        pageSize,
        status: logsHook.statusFilter,
        sortBy: logsHook.sortBy,
        sortDirection: logsHook.sortDirection,
      }),
    )
  }

  async function handleExportLogsCsv() {
    if (isExportingLogs) return
    setIsExportingLogs(true)
    toast.info('Carregando dados para exportar…')
    try {
      const logs = await fetchAllLogsForExport()
      exportToCsv('sincronizador-logs', LOGS_EXPORT_COLUMNS, logs.map(mapLogToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch (err) {
      toast.error(
        err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.',
      )
    } finally {
      setIsExportingLogs(false)
    }
  }

  async function handleExportLogsXlsx() {
    if (isExportingLogs) return
    setIsExportingLogs(true)
    toast.info('Carregando dados para exportar…')
    try {
      const logs = await fetchAllLogsForExport()
      await exportToXlsx('sincronizador-logs', LOGS_EXPORT_COLUMNS, logs.map(mapLogToExportRow))
      toast.success('Exportação Excel concluída.')
    } catch (err) {
      toast.error(
        err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.',
      )
    } finally {
      setIsExportingLogs(false)
    }
  }

  // Guarda de role — UX apenas; backend valida com [Authorize]
  if (!isGerentePlus) {
    return (
      <ErrorState
        message="Você não tem permissão para acessar esta área."
        className="mt-16"
      />
    )
  }

  const statusData = statusQuery.data
  const logsData = logsHook.query.data

  return (
    <div className="space-y-8">
      {/* Cabeçalho da página */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sincronizador HubSpot</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Monitoramento e controle da sincronização automática com o HubSpot.
        </p>
      </div>

      {/* ── Seção 1: Status ── */}
      <section aria-labelledby="status-heading" className="bg-card rounded-[5px] border border-border p-6 space-y-4">
        <h2 id="status-heading" className="text-[20px] font-medium text-foreground">
          Status
        </h2>

        {statusQuery.isLoading && <Skeleton lines={2} height="h-8" />}
        {statusQuery.isError && (
          <ErrorState
            message="Não foi possível carregar o status do sincronizador."
            onRetry={() => statusQuery.refetch()}
          />
        )}

        {statusData && (
          <div className="flex flex-wrap items-center gap-6">
            <SyncStatusBadge statusSistema={statusData.statusSistema} />

            {statusData.ultimaExecucao ? (
              <>
                <span className="text-sm text-foreground/70">
                  Última execução:{' '}
                  <span className="text-foreground font-medium">
                    {formatDate(statusData.ultimaExecucao.iniciadoEm)}
                  </span>
                </span>
                <span className="text-sm text-foreground/70">
                  Duração:{' '}
                  <DurationLabel
                    duracaoMs={statusData.ultimaExecucao.duracaoMs}
                    className="text-sm text-foreground font-medium"
                  />
                </span>
              </>
            ) : (
              <span className="text-sm text-foreground/50 italic">Nunca executado.</span>
            )}

            {statusData.intervaloMinutos > 0 && (
              <span className="text-sm text-foreground/70">
                Intervalo:{' '}
                <span className="text-foreground font-medium">
                  {statusData.intervaloMinutos} min
                </span>
              </span>
            )}

            <Button
              variant="primary"
              isLoading={runMutation.isPending}
              disabled={statusData.emExecucao}
              onClick={() => runMutation.mutate()}
              aria-label="Executar sincronização agora"
            >
              Executar agora
            </Button>
          </div>
        )}
      </section>

      {/* ── Seção 2: Log de Execuções ── */}
      <section aria-labelledby="logs-heading" className="bg-card rounded-[5px] border border-border p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 id="logs-heading" className="text-[20px] font-medium text-foreground">
            Log de Execuções
          </h2>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filtro por status */}
            <div className="w-44">
              <Combobox
                value={logsHook.statusFilter ?? ''}
                options={STATUS_OPTIONS}
                onChange={logsHook.handleStatusFilter}
                placeholder="Filtrar por status"
                size="sm"
              />
            </div>

            {logsData && logsData.items.length > 0 && (
              <ExportButtons
                onExportCsv={() => void handleExportLogsCsv()}
                onExportXlsx={() => void handleExportLogsXlsx()}
                isExporting={isExportingLogs}
              />
            )}
          </div>
        </div>

        {logsHook.query.isLoading && <Skeleton lines={6} />}
        {logsHook.query.isError && !logsHook.query.isFetching && (
          <ErrorState
            message="Não foi possível carregar os logs."
            onRetry={() => logsHook.query.refetch()}
          />
        )}
        {!logsHook.query.isLoading && !logsHook.query.isError && logsData && logsData.items.length === 0 && (
          <EmptyState message="Nenhuma execução registrada." />
        )}

        {logsData && logsData.items.length > 0 && (
          <>
            <LogsTable
              data={logsData.items}
              sortBy={logsHook.sortBy}
              sortDirection={logsHook.sortDirection}
              onSort={logsHook.handleSort}
            />
            <Pagination
              page={logsData.page}
              pageSize={logsData.pageSize}
              totalCount={logsData.totalCount}
              totalPages={logsData.totalPages}
              pageSizeOptions={[25, 50, 100, 200]}
              onPageChange={logsHook.setPage}
              onPageSizeChange={logsHook.setPageSize}
            />
          </>
        )}
      </section>

      {/* ── Seção 3: Equipes ── */}
      <section aria-labelledby="equipes-heading" className="bg-card rounded-[5px] border border-border p-6 space-y-4">
        <h2 id="equipes-heading" className="text-[20px] font-medium text-foreground">
          Equipes
        </h2>
        <p className="text-sm text-foreground/70">
          Sincroniza owners e equipes do HubSpot com o sistema. Use quando houver mudanças no time.
        </p>
        <SyncTeamsButton />
      </section>

      {/* ── Seção 4: Manutenção de Registros ── */}
      <section aria-labelledby="manutencao-heading" className="bg-card rounded-[5px] border border-border p-6 space-y-4">
        <h2 id="manutencao-heading" className="text-[20px] font-medium text-foreground">
          Manutenção de Registros
        </h2>
        <p className="text-sm text-foreground/70">
          Busque tickets e projetos pelo ID do HubSpot ou trecho do assunto. Registros ativos podem ser
          desativados manualmente.
        </p>
        <ManutencaoRegistros />
      </section>
    </div>
  )
}
