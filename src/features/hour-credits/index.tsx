import { useState } from 'react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Pagination } from '../../components/ui/Pagination'
import { Skeleton } from '../../components/ui/Skeleton'
import { usePermissions } from '../../hooks/usePermissions'
import { useReturnFocus } from '../../hooks/useReturnFocus'
import { buildHourCreditColumns } from './columns'
import { CreditosFiltros } from './components/CreditosFiltros'
import { EditarCreditoModal } from './components/EditarCreditoModal'
import { NovoCreditoForm } from './components/NovoCreditoForm'
import { useHourCreditMutations } from './hooks/useHourCreditMutations'
import { useHourCredits } from './hooks/useHourCredits'
import { formatHours } from '../reports/shared/utils/formatters'
import type { HourCreditDto } from './types/hourCredit'

/**
 * 132/F5 — Créditos de Horas (CRUD + filtros server-side).
 *
 * Permissão **`GerentePlus`** (D10), com a guarda **na página** — mesmo padrão do
 * Sincronizador (`routes/_auth/sincronizador.tsx:6-8`). É **UX apenas**: o backend é a
 * fonte de verdade e devolve `403` de qualquer forma (`usePermissions.ts:27-33`).
 *
 * D15: o motivo aparece com o **texto completo** aqui — junto com a tela de Motivos, é o
 * único par de telas onde ele pode aparecer. Em qualquer artefato que chegue ao cliente o
 * rótulo é `"Crédito de Suporte"`.
 *
 * Layout: `PageWrapper`, **não** `ReportPageLayout` — este último tem a identidade nominal
 * dos seus 6 consumidores travada em `ReportPageLayout.consumidores.test.ts:67-78`, e
 * entrar nessa lista obrigaria a mexer num invariante compartilhado por 6 telas.
 */
export default function HourCreditsPage() {
  const { isGerentePlus } = usePermissions()
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
  } = useHourCredits()
  const { create, update, remove } = useHourCreditMutations()

  const [toDelete, setToDelete] = useState<HourCreditDto | null>(null)
  const [toEdit, setToEdit] = useState<HourCreditDto | null>(null)
  const returnFocus = useReturnFocus()

  function handleOpenEdit(credito: HourCreditDto) {
    returnFocus.capture()
    setToEdit(credito)
  }

  function handleCloseEdit() {
    setToEdit(null)
    returnFocus.restore()
  }

  function handleConfirmDelete() {
    if (!toDelete) return
    remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
  }

  if (!isGerentePlus) {
    return <ErrorState message="Você não tem permissão para acessar esta área." className="mt-16" />
  }

  const columns = buildHourCreditColumns({
    onEdit: handleOpenEdit,
    onDelete: (credito) => setToDelete(credito),
  })

  const itens = data?.items ?? []

  return (
    <PageWrapper
      title="Créditos de Horas"
      breadcrumbItems={[{ label: 'Administração' }, { label: 'Créditos de Horas' }]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground/70 max-w-3xl">
          Créditos de horas somados ao plano do cliente na competência. O crédito vale{' '}
          <strong>uma competência</strong>: não se estende nem se transfere para o mês
          seguinte.
        </p>

        <div className="bg-card rounded-card border border-border p-4">
          <NovoCreditoForm
            onSubmit={(values) => create.mutateAsync(values)}
            isPending={create.isPending}
          />
        </div>

        <CreditosFiltros filters={filters} onChange={setFilters} />

        {/* Os 3 estados obrigatórios (`rules/frontend.md`) */}
        {isLoading && (
          <div className="bg-card rounded-card border border-border p-6">
            <Skeleton lines={8} />
          </div>
        )}
        {!isLoading && isError && (
          <ErrorState message="Não foi possível carregar os créditos." onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && itens.length === 0 && (
          <EmptyState message="Nenhum crédito encontrado para os filtros selecionados." />
        )}
        {!isLoading && !isError && itens.length > 0 && (
          <div className="bg-card rounded-card border border-border overflow-hidden">
            <DataTable
              tableId="hour-credits"
              columns={columns}
              data={itens}
              sortState={{ sortBy, sortDirection }}
              onSort={setSort}
            />
            {data && data.totalPages > 0 && (
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

      <EditarCreditoModal
        credito={toEdit}
        onSave={(credito, values) => update.mutateAsync({ id: credito.id, ...values })}
        onClose={handleCloseEdit}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        title="Excluir crédito"
        description={
          toDelete
            ? `Excluir o crédito de ${formatHours(toDelete.horas)} de ${
                toDelete.clienteNome ?? 'cliente'
              }? O plano efetivo da competência volta a ser calculado sem ele.`
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
