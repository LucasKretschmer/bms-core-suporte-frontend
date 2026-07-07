import { useMemo, useRef, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import type { SortState } from '../../components/ui/DataTable/types'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { ExportButtons } from '../reports/shared/components/ExportButtons'
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../reports/shared/utils/exportTable'
import { buildAgentColumns, agentSortValue, formatAgentTeams } from './columns'
import { useTeamMembers } from './hooks/useTeamMembers'
import {
  filterAgents,
  groupAgentsByTeam,
  listTeamOptions,
  SEM_EQUIPE_FILTER_VALUE,
  type AgentDto,
  type TeamsFilters,
} from './types/team'

/** Valor do seletor para "Todas as equipes". */
const TODAS_EQUIPES_VALUE = 'todas'

/** Colunas de export — espelham as colunas visíveis (sem campos internos). */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Atendente', key: 'nome' },
  { header: 'E-mail', key: 'email' },
  { header: 'Equipes', key: 'equipe' },
  { header: 'Perfil', key: 'papel' },
]

/**
 * 035 — 1 linha por atendente; as N equipes vão concatenadas (principal primeiro)
 * para não inflar a planilha (decisão R4 da arquitetura).
 */
function mapAgentToExportRow(agent: AgentDto): ExportRow {
  return {
    nome: agent.nome,
    email: agent.email ?? '—',
    equipe: formatAgentTeams(agent.equipes),
    papel: agent.papel,
  }
}

/**
 * F7 — Equipes e Atendentes.
 * Visível para CoordenadorPlus (UX); backend é a fonte de verdade.
 * Alterar o perfil (papel) exige GerentePlus — combobox só habilitado para esses (#13).
 */
export default function TeamsPage() {
  const { isCoordenadorOuAcima, isGerentePlus } = usePermissions()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useTeamMembers()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const [sortState, setSortState] = useState<SortState>({ sortBy: 'nome', sortDirection: 'asc' })

  // 037 — Filtros de tela (client-side). `searchInput` é o valor digitado;
  // `searchTerm` é aplicado com debounce (mesmo padrão da movimentação diária).
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [equipeId, setEquipeId] = useState<number | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setSearchTerm(value), 300)
  }

  function handleSort(sortKey: string) {
    setSortState((prev) =>
      prev.sortBy === sortKey
        ? { sortBy: sortKey, sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc' }
        : { sortBy: sortKey, sortDirection: 'asc' },
    )
  }

  const filters: TeamsFilters = useMemo(
    () => ({ search: searchTerm, equipeId }),
    [searchTerm, equipeId],
  )

  // Aplica os filtros (busca + equipe) sobre os dados já carregados (AND).
  const filteredAgents = useMemo(
    () => (data ? filterAgents(data, filters) : []),
    [data, filters],
  )

  // Ordenação client-side (lista completa sem paginação) — sobre os filtrados.
  const sortedAgents = useMemo(() => {
    const sortBy = sortState.sortBy ?? 'nome'
    const factor = sortState.sortDirection === 'asc' ? 1 : -1
    return [...filteredAgents].sort(
      (a, b) => agentSortValue(a, sortBy).localeCompare(agentSortValue(b, sortBy), 'pt-BR') * factor,
    )
  }, [filteredAgents, sortState])

  // Cards por equipe — agrupa os atendentes filtrados (035 inalterado).
  const teams = useMemo(() => groupAgentsByTeam(filteredAgents), [filteredAgents])

  // Opções do seletor de equipe — derivadas dos dados completos carregados.
  const teamSelectOptions = useMemo<ComboboxOption[]>(() => {
    const base = data ? listTeamOptions(data) : []
    return [
      { value: TODAS_EQUIPES_VALUE, label: 'Todas as equipes' },
      ...base.map((t) => ({
        value: String(t.id ?? SEM_EQUIPE_FILTER_VALUE),
        label: t.nome,
      })),
    ]
  }, [data])

  function handleEquipeChange(value: string) {
    setEquipeId(value === TODAS_EQUIPES_VALUE ? null : Number(value))
  }

  const columns = useMemo(
    () => buildAgentColumns({ canEditRole: isGerentePlus, currentUserId: user?.id ?? null }),
    [isGerentePlus, user?.id],
  )

  function handleExportCsv() {
    if (isExporting) return
    setIsExporting(true)
    try {
      exportToCsv('equipes-atendentes', EXPORT_COLUMNS, sortedAgents.map(mapAgentToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    if (isExporting) return
    setIsExporting(true)
    try {
      await exportToXlsx('equipes-atendentes', EXPORT_COLUMNS, sortedAgents.map(mapAgentToExportRow))
      toast.success('Exportação Excel concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  if (!isCoordenadorOuAcima) {
    return (
      <ErrorState
        message="Você não tem permissão para acessar esta área."
        className="mt-16"
      />
    )
  }

  const breadcrumb = [{ label: 'Administração' }, { label: 'Equipes e Atendentes' }]

  return (
    <PageWrapper title="Equipes e Atendentes" breadcrumbItems={breadcrumb}>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground/50 max-w-2xl">
          Equipes e owners vêm do HubSpot. O papel define permissões (ex.: cancelar/editar log de
          terceiros: coordenador/gerente).
        </p>

        {isLoading && (
          <div className="bg-card rounded-card border border-border p-6">
            <Skeleton lines={6} />
          </div>
        )}
        {!isLoading && isError && (
          <ErrorState message="Não foi possível carregar os atendentes." onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && data && data.length === 0 && (
          <EmptyState message="Nenhum atendente sincronizado." />
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <>
            {/* 037 — Filtros de tela (busca por nome/e-mail + equipe) */}
            <section
              aria-label="Filtros"
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <Input
                id="teams-search"
                label="Buscar atendente"
                placeholder="Nome ou e-mail…"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full sm:w-72"
                type="search"
              />
              <Combobox
                id="teams-equipe"
                label="Equipe"
                value={equipeId === null ? TODAS_EQUIPES_VALUE : String(equipeId)}
                options={teamSelectOptions}
                onChange={handleEquipeChange}
                className="w-full sm:w-64"
              />
            </section>

            {/* Tabela atendente / equipe / papel */}
            <section aria-labelledby="atendentes-heading" className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <h2 id="atendentes-heading" className="text-[16px] font-medium text-foreground">
                  Atendentes
                </h2>
                <ExportButtons
                  onExportCsv={handleExportCsv}
                  onExportXlsx={() => void handleExportXlsx()}
                  isExporting={isExporting}
                />
              </div>
              {sortedAgents.length === 0 ? (
                <EmptyState message="Nenhum atendente encontrado." />
              ) : (
                <div className="bg-card rounded-card border border-border overflow-hidden">
                  <DataTable
                    tableId="teams-agents"
                    columns={columns}
                    data={sortedAgents}
                    sortState={sortState}
                    onSort={handleSort}
                  />
                </div>
              )}
            </section>

            {/* Cards por equipe */}
            <section aria-labelledby="equipes-heading" className="flex flex-col gap-2">
              <h2 id="equipes-heading" className="text-[16px] font-medium text-foreground">
                Equipes
              </h2>
              {teams.length === 0 ? (
                <EmptyState message="Nenhuma equipe encontrada." />
              ) : (
                <div className="flex flex-wrap gap-3">
                {teams.map((team) => (
                  <div
                    key={team.id ?? team.nome}
                    className="bg-card rounded-card border border-border p-4 min-w-[220px] flex-1 max-w-sm"
                  >
                    <h3 className="text-sm font-medium text-foreground">
                      {team.nome}{' '}
                      <span className="text-foreground/50 font-normal">
                        · {team.membros.length}{' '}
                        {team.membros.length === 1 ? 'membro' : 'membros'}
                      </span>
                    </h3>
                    <ul className="mt-3 flex flex-col gap-2">
                      {team.membros.map((membro) => (
                        <li
                          key={`${team.id ?? 'sem-equipe'}-${membro.userId}`}
                          className="flex items-center justify-between gap-2 text-sm text-foreground"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{membro.nome}</span>
                            {membro.isPrimary && (
                              <span
                                className="text-xs text-foreground/50"
                                title="Equipe principal do atendente"
                              >
                                (principal)
                              </span>
                            )}
                          </span>
                          <Badge value={membro.papel} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageWrapper>
  )
}
