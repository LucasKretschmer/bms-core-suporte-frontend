import { clsx } from 'clsx'

type ExternalLinkIconProps = {
  className?: string
}

/**
 * Ícone "abre em nova aba", decorativo (`aria-hidden`) — o significado vem do
 * `title`/texto do link que o acompanha.
 *
 * Extraído porque o mesmo SVG estava copiado em 3 tabelas
 * (`client-tickets/columns.tsx`, `reports/appointments/columns.tsx`,
 * `reports/client-report/columns.tsx`). 121/FAT-5 passou a usá-lo também no
 * relatório de exceções; as duas cópias restantes ficam como limpeza pendente
 * (arquivos fora do escopo desta unidade).
 */
export function ExternalLinkIcon({ className }: ExternalLinkIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={clsx('inline-block ml-1 h-3 w-3 text-foreground/50 shrink-0', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  )
}
