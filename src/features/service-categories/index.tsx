import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { Switch } from '../../components/ui/Switch'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { useToast } from '../../components/ui/Toast'
import { usePermissions } from '../../hooks/usePermissions'
import { useReturnFocus } from '../../hooks/useReturnFocus'
import { ExportButtons } from '../reports/shared/components/ExportButtons'
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../reports/shared/utils/exportTable'
import { buildCategoryColumns } from './columns'
import { EditCategoryModal } from './components/EditCategoryModal'
import { useCategoryMutations } from './hooks/useCategoryMutations'
import { useServiceCategories } from './hooks/useServiceCategories'
import {
  newCategorySchema,
  rotuloCobrancaForaDoPlano,
  type NewCategoryFormValues,
  type ServiceCategoryDto,
} from './types/serviceCategory'

/**
 * F6 — Categorias do Atendimento (CRUD + toggle).
 * Visível para CoordenadorPlus (UX); backend é a fonte de verdade.
 */
/**
 * Colunas de export — espelham a tabela (sem campos internos).
 *
 * 133: `cobrancaForaDoPlano` é o **quarto lugar** onde a flag aparece (coluna, modal de
 * edição, form de criação e aqui) — e o mais grave dos quatro (`AP-FRONTEND-028`): a
 * planilha sai do sistema e é encaminhada, sem volta. O rótulo vem de
 * `rotuloCobrancaForaDoPlano`, a MESMA função da coluna da tabela, para que os dois nunca
 * divirjam.
 */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Categoria', key: 'nome' },
  { header: 'Situação', key: 'situacao' },
  { header: 'Cobrança fora do plano', key: 'cobrancaForaDoPlano' },
]

function mapCategoryToExportRow(category: ServiceCategoryDto): ExportRow {
  return {
    nome: category.nome,
    situacao: category.isActive ? 'Ativa' : 'Inativa',
    cobrancaForaDoPlano: rotuloCobrancaForaDoPlano(category),
  }
}

/**
 * id do texto de apoio da flag no form de criação (133) — o `<p>` e o `aria-describedby`
 * do switch leem a MESMA constante, para o atributo nunca ficar órfão.
 */
const ID_APOIO_NOVA_FORCA = 'nova-categoria-forca-apoio'

/** Estado inicial do form de criação — usado no `defaultValues` e no `reset`. */
const NOVA_CATEGORIA_PADRAO: NewCategoryFormValues = { nome: '', forcesBillableOutsidePlan: false }

export default function ServiceCategoriesPage() {
  const { isCoordenadorOuAcima } = usePermissions()
  const { data, isLoading, isError, refetch } = useServiceCategories()
  const { create, update, toggleActive, remove } = useCategoryMutations()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  // Estados SEPARADOS de propósito: excluir e renomear nunca abrem juntos.
  const [toDelete, setToDelete] = useState<ServiceCategoryDto | null>(null)
  const [toEdit, setToEdit] = useState<ServiceCategoryDto | null>(null)
  // Devolução do foco ao botão "editar" da linha (o Modal prende, quem abre devolve).
  const returnFocus = useReturnFocus()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewCategoryFormValues>({
    resolver: zodResolver(newCategorySchema),
    defaultValues: NOVA_CATEGORIA_PADRAO,
  })

  const novaForcaCobranca = watch('forcesBillableOutsidePlan')

  function onSubmit(values: NewCategoryFormValues) {
    // Os dois campos vão juntos, e o `reset` repõe os dois — repor só o nome deixaria o
    // switch ligado para a próxima categoria digitada.
    create.mutate(values, { onSuccess: () => reset(NOVA_CATEGORIA_PADRAO) })
  }

  function handleOpenEdit(category: ServiceCategoryDto) {
    returnFocus.capture()
    setToEdit(category)
  }

  function handleCloseEdit() {
    setToEdit(null)
    returnFocus.restore()
  }

  function handleConfirmDelete() {
    if (!toDelete) return
    remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
  }

  function handleExportCsv() {
    if (isExporting || !data) return
    setIsExporting(true)
    try {
      exportToCsv('categorias-atendimento', EXPORT_COLUMNS, data.map(mapCategoryToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    if (isExporting || !data) return
    setIsExporting(true)
    try {
      await exportToXlsx('categorias-atendimento', EXPORT_COLUMNS, data.map(mapCategoryToExportRow))
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

  const columns = buildCategoryColumns({
    onToggle: (category) => toggleActive.mutate({ id: category.id, isActive: !category.isActive }),
    onEdit: handleOpenEdit,
    onDelete: (category) => setToDelete(category),
    isToggling: toggleActive.isPending,
    isDeleting: remove.isPending,
  })

  const breadcrumb = [
    { label: 'Administração' },
    { label: 'Categorias do Atendimento' },
  ]

  return (
    <PageWrapper title="Categorias do Atendimento" breadcrumbItems={breadcrumb}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground/70 max-w-2xl">
          Usada no encerramento do timer (consultoria, treinamento, plantão…). Não confundir com a
          categoria do ticket (HubSpot).
        </p>

        {/* Toolbar: nova categoria + export */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-1"
            aria-label="Adicionar nova categoria"
          >
            <div className="flex items-start gap-2">
              <div className="w-72">
                <Input
                  id="nova-categoria"
                  placeholder="Nova categoria…"
                  aria-label="Nome da nova categoria"
                  error={errors.nome?.message}
                  {...register('nome')}
                />
              </div>
              <Button type="submit" variant="primary" isLoading={isSubmitting || create.isPending}>
                Adicionar
              </Button>
            </div>

            {/* 133 — a flag já na criação: categoria de consultoria/plantão nasce travada. */}
            <div className="flex items-start gap-2">
              <Switch
                label="Cobrar sempre fora do plano"
                checked={novaForcaCobranca}
                onChange={(checked) =>
                  setValue('forcesBillableOutsidePlan', checked, { shouldDirty: true })
                }
                describedById={ID_APOIO_NOVA_FORCA}
              />
              <div className="max-w-md">
                <p className="text-sm font-medium text-foreground">
                  Cobrar sempre fora do plano
                </p>
                <p id={ID_APOIO_NOVA_FORCA} className="text-xs text-foreground/70">
                  Apontamentos com esta categoria serão sempre marcados como cobrados fora do
                  plano; o atendente não poderá desmarcar.
                </p>
              </div>
            </div>
          </form>

          {data && data.length > 0 && (
            <ExportButtons
              onExportCsv={handleExportCsv}
              onExportXlsx={() => void handleExportXlsx()}
              isExporting={isExporting}
            />
          )}
        </div>

        {/* Estados de UI */}
        {isLoading && (
          <div className="bg-card rounded-card border border-border p-6">
            <Skeleton lines={6} />
          </div>
        )}
        {!isLoading && isError && (
          <ErrorState
            message="Não foi possível carregar as categorias."
            onRetry={() => refetch()}
          />
        )}
        {!isLoading && !isError && data && data.length === 0 && (
          <EmptyState message="Nenhuma categoria cadastrada." />
        )}
        {!isLoading && !isError && data && data.length > 0 && (
          <div className="bg-card rounded-card border border-border overflow-hidden">
            <DataTable tableId="service-categories" columns={columns} data={data} />
          </div>
        )}
      </div>

      <EditCategoryModal
        category={toEdit}
        onSave={(category, values) => update.mutateAsync({ id: category.id, ...values })}
        onClose={handleCloseEdit}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        title="Excluir categoria"
        description={
          toDelete
            ? `Excluir a categoria "${toDelete.nome}"? Esta ação não pode ser desfeita.`
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
