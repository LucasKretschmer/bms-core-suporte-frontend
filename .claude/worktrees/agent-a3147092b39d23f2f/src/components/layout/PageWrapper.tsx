import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb'

type PageWrapperProps = {
  title: string
  breadcrumbItems: BreadcrumbItem[]
  actions?: React.ReactNode
  children: React.ReactNode
}

/**
 * Casca de página: breadcrumb + título h1 + slot de ações + conteúdo.
 * Usado em toda tela autenticada.
 */
export function PageWrapper({ title, breadcrumbItems, actions, children }: PageWrapperProps) {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header da página */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Breadcrumb items={breadcrumbItems} />
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {/* Conteúdo */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
