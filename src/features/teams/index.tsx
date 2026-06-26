import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import type { SortState } from '../../components/ui/DataTable/types'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { buildAgentColumns, agentSortValue } from './columns'
import { useTeamMembers } from './hooks/useTeamMembers'
import { groupAgentsByTeam } from './types/team'

/**
 * F7 — Equipes e Atendentes.
 * Visível para CoordenadorPlus (UX); backend é a fonte de verdade.
 * Alterar o perfil (papel) exige GerentePlus — combobox só habilitado para esses (#13).
 */
export default function TeamsPage() {
  const { isCoordenadorOuAcima, isGerentePlus } = usePermissions()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useTeamMembers()

  const [sortState, setSortState] = useState<SortState>({ sortBy: 'nome', sortDirection: 'asc' })

  function handleSort(sortKey: string) {
    setSortState((prev) =>
      prev.sortBy === sortKey
        ? { sortBy: sortKey, sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc' }
        : { sortBy: sortKey, sortDirection: 'asc' },
    )
  }

  // Ordenação client-side (lista completa sem paginação)
  const sortedAgents = useMemo(() => {
    if (!data) return []
    const sortBy = sortState.sortBy ?? 'nome'
    const factor = sortState.sortDirection === 'asc' ? 1 : -1
    return [...data].sort(
      (a, b) => agentSortValue(a, sortBy).localeCompare(agentSortValue(b, sortBy), 'pt-BR') * factor,
    )
  }, [data, sortState])

  const teams = useMemo(() => (data ? groupAgentsByTeam(data) : []), [data])

  const columns = useMemo(
    () => buildAgentColumns({ canEditRole: isGerentePlus, currentUserId: user?.id ?? null }),
    [isGerentePlus, user?.id],
  )

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
          <div className="bg-card rounded-[5px] border border-border p-6">
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
            {/* Tabela atendente / equipe / papel */}
            <section aria-labelledby="atendentes-heading" className="flex flex-col gap-2">
              <h2 id="atendentes-heading" className="text-[16px] font-medium text-foreground">
                Atendentes
              </h2>
              <div className="bg-card rounded-[5px] border border-border overflow-hidden">
                <DataTable
                  tableId="teams-agents"
                  columns={columns}
                  data={sortedAgents}
                  sortState={sortState}
                  onSort={handleSort}
                />
              </div>
            </section>

            {/* Cards por equipe */}
            <section aria-labelledby="equipes-heading" className="flex flex-col gap-2">
              <h2 id="equipes-heading" className="text-[16px] font-medium text-foreground">
                Equipes
              </h2>
              <div className="flex flex-wrap gap-3">
                {teams.map((team) => (
                  <div
                    key={team.id ?? team.nome}
                    className="bg-card rounded-xl border border-border p-4 min-w-[220px] flex-1 max-w-sm"
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
                          key={membro.userId}
                          className="flex items-center justify-between gap-2 text-sm text-foreground"
                        >
                          <span className="truncate">{membro.nome}</span>
                          <Badge value={membro.papel} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </PageWrapper>
  )
}
