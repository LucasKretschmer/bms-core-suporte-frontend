import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { usePermissions } from '../../hooks/usePermissions'
import { useReturnFocus } from '../../hooks/useReturnFocus'
import { buildSupportPlanColumns } from './columns'
import { SupportPlanFormModal, type CalendarsStatus } from './components/SupportPlanFormModal'
import { UnmatchedPlansCard } from './components/UnmatchedPlansCard'
import { useSupportPlanMutations } from './hooks/useSupportPlanMutations'
import { usePlanCalendars, useSupportPlans, useUnmatchedPlans } from './hooks/useSupportPlans'
import type { SupportPlanDto, SupportPlanRequest } from './types/supportPlan'

/**
 * 124/F1 — Planos de suporte.
 *
 * ## O que esta tela é, e o que ela NÃO é
 *
 * O PRD a descrevia como "migrar os tempos por plano, hoje cravados, para uma tela". Isso
 * é falso e está registrado em `124/arquitetura.md` §0 C-1: as horas **já vêm do
 * cadastro** (`MetricsQueryRepository.cs:1257`, `ReportQueryRepository.cs:752` —
 * `c.HorasOverride ?? c.SupportPlan.HorasMes`). Nenhuma tela existente muda por causa
 * desta unidade, e não há valor cravado no frontend para migrar.
 *
 * ## Esta tela é o GATILHO de um defeito conhecido (§0 C-2, R-1)
 *
 * O vínculo cliente↔plano é resolvido pelo **nome** do plano
 * (`CompanySyncService.cs:330-341`). Dar ao usuário um botão de renomear, sozinho, ativa
 * um defeito que o `cfg-1` §1.1 já classificava como latente — *"vira agudo no momento em
 * que a tela for construída"*. Por isso a tela nasce com: o campo **Identificador do
 * HubSpot** em primeiro plano, a marcação de vínculo frágil na tabela, o aviso preventivo
 * no formulário e o tratamento específico do `422 PLAN_RENAME_UNSAFE`.
 *
 * ## Permissões (UX; o backend é a fonte de verdade)
 *
 * `GET` exige `CoordenadorPlus` e `POST`/`PUT` exigem `GerentePlus`
 * (`SupportPlansController.cs:29,42,63`). Quem é Coordenador **vê** a tela e **não vê** as
 * ações de escrita — barrar antes evita o 403 depois de o usuário preencher o formulário.
 */

/** Cabeçalho da tabela por estado da query — o retorno é sempre uma seção com moldura. */
function estadoDosCalendarios(args: { isLoading: boolean; isError: boolean }): CalendarsStatus {
  if (args.isLoading) return 'loading'
  if (args.isError) return 'error'
  return 'ready'
}

export default function SupportPlansPage() {
  const { isCoordenadorOuAcima, isGerentePlus } = usePermissions()
  const plans = useSupportPlans()
  const unmatched = useUnmatchedPlans()
  const calendars = usePlanCalendars()
  const { create, update } = useSupportPlanMutations()

  /** `null` fechado · `{ plan }` edição · `{ plan: null, hubspotValor }` criação. */
  const [formState, setFormState] = useState<{
    plan: SupportPlanDto | null
    hubspotValor: string
  } | null>(null)
  const returnFocus = useReturnFocus()

  function abrirFormulario(plan: SupportPlanDto | null, hubspotValor = '') {
    returnFocus.capture()
    setFormState({ plan, hubspotValor })
  }

  function fecharFormulario() {
    setFormState(null)
    returnFocus.restore()
  }

  async function handleSave(plan: SupportPlanDto | null, payload: SupportPlanRequest) {
    if (plan != null) {
      return update.mutateAsync({ id: plan.id, payload })
    }
    return create.mutateAsync(payload)
  }

  if (!isCoordenadorOuAcima) {
    return <ErrorState message="Você não tem permissão para acessar esta área." className="mt-16" />
  }

  const columns = buildSupportPlanColumns({
    onEdit: (plan) => abrirFormulario(plan),
    calendarios: calendars.data ?? [],
    podeEditar: isGerentePlus,
  })

  const breadcrumb = [{ label: 'Administração' }, { label: 'Planos de Suporte' }]

  return (
    <PageWrapper
      title="Planos de Suporte"
      breadcrumbItems={breadcrumb}
      actions={
        isGerentePlus ? (
          <Button variant="primary" onClick={() => abrirFormulario(null)}>
            Novo plano
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {/* /70 sobre o `bg-background` da pagina = 5,20:1 (AA). O /50 media 2,95:1 e
            reprovava — QA 124 D-3, o mesmo token que FE-F2F3 ja havia reprovado. */}
        <p className="max-w-3xl text-sm text-foreground/70">
          Horas contratadas, meta de 1º atendimento e calendário de cada plano. O identificador do
          HubSpot é o que liga o plano ao valor enviado pelo CRM — sem ele, a associação é feita
          pelo nome do plano.
        </p>

        <UnmatchedPlansCard
          itens={unmatched.data}
          isLoading={unmatched.isLoading}
          isError={unmatched.isError}
          onRetry={() => void unmatched.refetch()}
          onCriarPlano={
            isGerentePlus ? (valor) => abrirFormulario(null, valor) : undefined
          }
        />

        {plans.isLoading && (
          <div className="rounded-card border border-border bg-card p-6">
            <Skeleton lines={6} />
          </div>
        )}
        {!plans.isLoading && plans.isError && (
          <ErrorState
            message="Não foi possível carregar os planos de suporte."
            onRetry={() => void plans.refetch()}
          />
        )}
        {!plans.isLoading && !plans.isError && plans.data && plans.data.length === 0 && (
          /* 125/FE-A11Y-1 — de volta ao `EmptyState` compartilhado. O contorno local que
             estava aqui existia porque a mensagem do componente saía em
             `text-xs italic text-primary/30` (1,84:1, QA 124 `D-2`); o wrapper agora
             renderiza a própria mensagem em `text-foreground` (13,82:1) e a descrição em
             `text-foreground/70` (5,47:1), medidas no DOM por
             `src/utils/primitivosDeUiContraste.test.tsx`. */
          <EmptyState
            className="rounded-card border border-border bg-card"
            message="Nenhum plano de suporte cadastrado."
            description="Cadastre os planos para definir as horas contratadas, a meta de 1º atendimento e o calendário de cada um."
          />
        )}
        {!plans.isLoading && !plans.isError && plans.data && plans.data.length > 0 && (
          <div className="overflow-hidden rounded-card border border-border bg-card">
            <DataTable tableId="support-plans" columns={columns} data={plans.data} />
          </div>
        )}
      </div>

      <SupportPlanFormModal
        isOpen={formState !== null}
        plan={formState?.plan ?? null}
        hubspotValorInicial={formState?.hubspotValor ?? ''}
        calendarios={calendars.data ?? []}
        calendariosStatus={estadoDosCalendarios({
          isLoading: calendars.isLoading,
          isError: calendars.isError,
        })}
        onSave={handleSave}
        onClose={fecharFormulario}
      />
    </PageWrapper>
  )
}
