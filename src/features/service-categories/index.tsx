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
import { PageWrapper } from '../../components/layout/PageWrapper'
import { useToast } from '../../components/ui/Toast'
import { usePermissions } from '../../hooks/usePermissions'
import { ExportButtons } from '../reports/shared/components/ExportButtons'
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../reports/shared/utils/exportTable'
import { buildCategoryColumns } from './columns'
import { useCategoryMutations } from './hooks/useCategoryMutations'
import { useServiceCategories } from './hooks/useServiceCategories'
import {
  newCategorySchema,
  type NewCategoryFormValues,
  type ServiceCategoryDto,
} from './types/serviceCategory'

/**
 * F6 — Categorias do Atendimento (CRUD + toggle).
 * Visível para CoordenadorPlus (UX); backend é a fonte de verdade.
 */
/** Colunas de export — espelham a tabela (sem campos internos). */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Categoria', key: 'nome' },
  { header: 'Situação', key: 'situacao' },
]

function mapCategoryToExportRow(category: ServiceCategoryDto): ExportRow {
  return {
    nome: category.nome,
    situacao: category.isActive ? 'Ativa' : 'Inativa',
  }
}

export default function ServiceCategoriesPage() {
  const { isCoordenadorOuAcima } = usePermissions()
  const { data, isLoading, isError, refetch } = useServiceCategories()
  const { create, toggleActive, remove } = useCategoryMutations()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const [toDelete, setToDelete] = useState<ServiceCategoryDto | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewCategoryFormValues>({
    resolver: zodResolver(newCategorySchema),
    defaultValues: { nome: '' },
  })

  function onSubmit(values: NewCategoryFormValues) {
    create.mutate(values.nome, { onSuccess: () => reset({ nome: '' }) })
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
        <p className="text-sm text-foreground/50 max-w-2xl">
          Usada no encerramento do timer (consultoria, treinamento, plantão…). Não confundir com a
          categoria do ticket (HubSpot).
        </p>

        {/* Toolbar: nova categoria + export */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex items-start gap-2"
            aria-label="Adicionar nova categoria"
          >
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
