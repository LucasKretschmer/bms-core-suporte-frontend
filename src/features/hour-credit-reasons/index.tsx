import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { usePermissions } from '../../hooks/usePermissions'
import { useReturnFocus } from '../../hooks/useReturnFocus'
import { buildHourCreditReasonColumns } from './columns'
import { EditarMotivoModal } from './components/EditarMotivoModal'
import { useHourCreditReasonMutations } from './hooks/useHourCreditReasonMutations'
import { useHourCreditReasons } from './hooks/useHourCreditReasons'
import {
  ehMotivoDeSistema,
  novoMotivoSchema,
  type HourCreditReasonDto,
  type NovoMotivoFormValues,
} from './types/hourCreditReason'

/**
 * 132/F6 — Motivos de Crédito de Horas (CRUD).
 *
 * Permissão **`GerentePlus`** (D10). A guarda vive **na página**, não na rota — mesmo
 * padrão do Sincronizador (`routes/_auth/sincronizador.tsx:6-8`) e de
 * `service-categories/index.tsx:144-151`. É **UX apenas**: o backend é a fonte de verdade
 * (`usePermissions.ts:27-33`) e devolve `403` de qualquer forma.
 *
 * D15: aqui o texto **completo** do motivo aparece — é tela de gerência. Em qualquer
 * artefato que chegue ao cliente o rótulo é `"Crédito de Suporte"`.
 *
 * Layout: `PageWrapper`, **não** `ReportPageLayout` — `ReportPageLayout.consumidores.test.ts`
 * trava a identidade nominal dos 6 consumidores e das telas sem teste de página; usar o
 * layout de relatório aqui reprovaria os dois e obrigaria a mexer num invariante
 * compartilhado por 6 telas.
 */
export default function HourCreditReasonsPage() {
  const { isGerentePlus } = usePermissions()
  // A tela lista ativos e inativos: a situação é uma coluna, e esconder inativo faria o
  // 409 MOTIVO_DUPLICADO parecer inexplicável (o nome conflitante estaria invisível).
  const { data, isLoading, isError, refetch } = useHourCreditReasons(true)
  const { create, update, remove } = useHourCreditReasonMutations()

  const [toDelete, setToDelete] = useState<HourCreditReasonDto | null>(null)
  const [toEdit, setToEdit] = useState<HourCreditReasonDto | null>(null)
  const returnFocus = useReturnFocus()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NovoMotivoFormValues>({
    resolver: zodResolver(novoMotivoSchema),
    defaultValues: { nome: '' },
  })

  function onSubmit(values: NovoMotivoFormValues) {
    create.mutate(values.nome, { onSuccess: () => reset({ nome: '' }) })
  }

  function handleOpenEdit(motivo: HourCreditReasonDto) {
    // Guard de segunda camada: a coluna já bloqueia a ação do motivo de sistema, mas o
    // handler é público e o custo de errar aqui é alto. Fail-closed nas duas pontas.
    if (ehMotivoDeSistema(motivo)) return
    returnFocus.capture()
    setToEdit(motivo)
  }

  function handleCloseEdit() {
    setToEdit(null)
    returnFocus.restore()
  }

  function handleAskDelete(motivo: HourCreditReasonDto) {
    if (ehMotivoDeSistema(motivo)) return
    setToDelete(motivo)
  }

  function handleConfirmDelete() {
    if (!toDelete) return
    remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
  }

  if (!isGerentePlus) {
    return <ErrorState message="Você não tem permissão para acessar esta área." className="mt-16" />
  }

  const columns = buildHourCreditReasonColumns({
    onEdit: handleOpenEdit,
    onDelete: handleAskDelete,
  })

  return (
    <PageWrapper
      title="Motivos de Crédito"
      breadcrumbItems={[{ label: 'Administração' }, { label: 'Motivos de Crédito' }]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground/70 max-w-2xl">
          Motivos usados no cadastro manual de créditos de horas e pelo processo automático
          de crédito.
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-start gap-2"
          aria-label="Adicionar novo motivo"
        >
          <div className="w-96">
            <Input
              id="novo-motivo"
              placeholder="Novo motivo…"
              aria-label="Nome do novo motivo"
              error={errors.nome?.message}
              {...register('nome')}
            />
          </div>
          <Button type="submit" variant="primary" isLoading={isSubmitting || create.isPending}>
            Adicionar
          </Button>
        </form>

        {/* Os 3 estados obrigatórios (`rules/frontend.md`) */}
        {isLoading && (
          <div className="bg-card rounded-card border border-border p-6">
            <Skeleton lines={5} />
          </div>
        )}
        {!isLoading && isError && (
          <ErrorState message="Não foi possível carregar os motivos." onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && data && data.length === 0 && (
          <EmptyState message="Nenhum motivo cadastrado." />
        )}
        {!isLoading && !isError && data && data.length > 0 && (
          <div className="bg-card rounded-card border border-border overflow-hidden">
            <DataTable tableId="hour-credit-reasons" columns={columns} data={data} />
          </div>
        )}
      </div>

      <EditarMotivoModal
        motivo={toEdit}
        onSave={(motivo, values) => update.mutateAsync({ id: motivo.id, nome: values.nome })}
        onClose={handleCloseEdit}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        title="Excluir motivo"
        description={
          toDelete
            ? // A recusa por uso é do SERVIDOR (409 MOTIVO_EM_USO, `analise-backend.md` §7.3):
              // o texto avisa que ela pode acontecer em vez de prometer que a exclusão passa.
              `Excluir o motivo "${toDelete.nome}"? Se houver créditos ativos com este motivo, a exclusão será recusada.`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        isLoading={remove.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setToDelete(null)}
      />
    </PageWrapper>
  )
}
