import { useMemo } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { usePermissions } from '../../hooks/usePermissions'
import { GlobalRulesCard } from './components/GlobalRulesCard'
import { TeamRulesCard } from './components/TeamRulesCard'
import { useGlobalRules, useTeamRules, useTeamsList } from './hooks/useBusinessRules'
import { useRuleMutations } from './hooks/useRuleMutations'
import { GLOBAL_IDLE_KEY } from './types/businessRule'

/**
 * F8 — Configurações / Regras de negócio.
 * Regra global (alerta de inatividade) + 1 card por equipe com toggles + combo.
 * Visível para CoordenadorPlus (UX); backend é a fonte de verdade.
 */
export default function BusinessRulesPage() {
  const { isCoordenadorOuAcima } = usePermissions()

  const globalQuery = useGlobalRules()
  const teamsQuery = useTeamsList()
  const saveMutation = useRuleMutations()

  const teamIds = useMemo(() => (teamsQuery.data ?? []).map((t) => t.id), [teamsQuery.data])
  const teamRules = useTeamRules(teamIds)

  if (!isCoordenadorOuAcima) {
    return (
      <ErrorState
        message="Você não tem permissão para acessar esta área."
        className="mt-16"
      />
    )
  }

  const breadcrumb = [{ label: 'Administração' }, { label: 'Configurações' }]

  const isLoading = globalQuery.isLoading || teamsQuery.isLoading
  const isError = globalQuery.isError || teamsQuery.isError

  return (
    <PageWrapper title="Configurações" breadcrumbItems={breadcrumb}>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground/50 max-w-2xl">
          Regras de negócio aplicadas ao timer e às equipes. Alterações são salvas automaticamente.
        </p>

        {isLoading && (
          <div className="bg-card rounded-card border border-border p-6">
            <Skeleton lines={6} />
          </div>
        )}
        {!isLoading && isError && (
          <ErrorState
            message="Não foi possível carregar as configurações."
            onRetry={() => {
              globalQuery.refetch()
              teamsQuery.refetch()
            }}
          />
        )}

        {!isLoading && !isError && (
          <>
            <GlobalRulesCard
              rules={globalQuery.data ?? []}
              isSaving={saveMutation.isPending}
              onSaveIdle={({ ruleId, minutes }) =>
                saveMutation.mutate({
                  ruleId,
                  teamId: null,
                  chave: GLOBAL_IDLE_KEY,
                  valor: minutes,
                })
              }
            />

            <section aria-labelledby="team-rules-heading" className="flex flex-col gap-3">
              <h2 id="team-rules-heading" className="text-[16px] font-medium text-foreground">
                Por equipe
              </h2>

              {(teamsQuery.data ?? []).length === 0 ? (
                <EmptyState message="Nenhuma equipe cadastrada." />
              ) : (
                <div className="flex flex-wrap gap-4">
                  {(teamsQuery.data ?? []).map((team) => {
                    const tr = teamRules[team.id]
                    return (
                      <TeamRulesCard
                        key={team.id}
                        teamNome={team.nome}
                        rules={tr?.rules ?? []}
                        isLoading={tr?.isLoading ?? true}
                        isError={tr?.isError ?? false}
                        isSaving={saveMutation.isPending}
                        onSave={({ ruleId, chave, valor }) =>
                          saveMutation.mutate({ ruleId, teamId: team.id, chave, valor })
                        }
                      />
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageWrapper>
  )
}
