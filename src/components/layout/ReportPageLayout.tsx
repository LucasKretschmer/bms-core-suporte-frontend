import type { BreadcrumbItem } from './Breadcrumb'
import { PageWrapper } from './PageWrapper'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Skeleton } from '../ui/Skeleton'

type ReportPageLayoutProps = {
  title: string
  breadcrumbItems: BreadcrumbItem[]
  /** Slot de filtros acima da tabela */
  filters?: React.ReactNode
  /** Slot de botões de export */
  exportActions?: React.ReactNode
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  onRetry: () => void
  emptyMessage?: string
  /** DataTable + Pagination */
  children: React.ReactNode
}

/**
 * Casca visual das 4 telas de relatório.
 * Trata os 3 estados de UI obrigatórios: loading → Skeleton, error → ErrorState, empty → EmptyState.
 * Exibe filtros e botões de export apenas quando há dados.
 */
export function ReportPageLayout({
  title,
  breadcrumbItems,
  filters,
  exportActions,
  isLoading,
  isError,
  isEmpty,
  onRetry,
  emptyMessage = 'Nenhum item encontrado.',
  children,
}: ReportPageLayoutProps) {
  return (
    <PageWrapper
      title={title}
      breadcrumbItems={breadcrumbItems}
      actions={exportActions}
    >
      {/* Barra de filtros */}
      {filters && (
        <div className="mb-4 p-4 bg-card rounded-[5px] border border-border">
          {filters}
        </div>
      )}

      {/* Estados de UI */}
      {isLoading && (
        <div className="bg-card rounded-[5px] border border-border p-6">
          <Skeleton lines={8} />
        </div>
      )}
      {!isLoading && isError && (
        <ErrorState onRetry={onRetry} />
      )}
      {!isLoading && !isError && isEmpty && (
        <EmptyState message={emptyMessage} />
      )}
      {!isLoading && !isError && !isEmpty && (
        <div className="bg-card rounded-[5px] border border-border overflow-hidden">
          {children}
        </div>
      )}
    </PageWrapper>
  )
}
