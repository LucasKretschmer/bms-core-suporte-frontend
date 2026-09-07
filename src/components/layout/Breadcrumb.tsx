import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'

export type BreadcrumbItem = {
  label: string
  href?: string
  /** Params da rota tipada (ex.: { clientId }) — repassados ao <Link params> */
  params?: Record<string, string>
  /** Search params a preservar (ex.: filtros/origem) — repassados ao <Link search> */
  search?: Record<string, unknown>
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Breadcrumb de navegação. Último item sem link.
 * Separador: •
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Navegação estrutural" className={clsx('flex items-center flex-wrap gap-1 text-xs text-foreground/70', className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <span key={idx} className="flex items-center gap-1">
            {/* 125/FE-A11Y-3 (`A-1`) — MEDIDO e MANTIDO em `/40`. Sobre a página (#f0f4f7)
                ele dá 2,31:1, abaixo do piso AA — mas o piso AA é de TEXTO, e este `•` é
                `aria-hidden` e puramente decorativo: a estrutura da trilha já vem da
                semântica do `<nav>` e da ordem dos itens, nenhum significado depende de
                enxergá-lo. Leitor de tela não o anuncia. Trocar seria escurecer um
                separador que existe só para dar respiro visual. A varredura de contraste
                do repo o exclui pelo mesmo critério (`ehDecorativo`), e há teste em
                `utils/contrasteDeTexto.test.ts` provando que ele sai da medição
                enquanto o texto irmão continua sendo medido. */}
            {idx > 0 && <span aria-hidden="true" className="text-foreground/40">•</span>}
            {isLast || !item.href ? (
              <span
                className={isLast ? 'text-foreground/80 font-medium' : ''}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                params={item.params}
                search={item.search}
                className="hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
