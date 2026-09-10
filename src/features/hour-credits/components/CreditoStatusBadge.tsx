import { clsx } from 'clsx'
import {
  normalizarStatusDoCredito,
  rotuloDoStatus,
  TOKEN_DESCONHECIDO,
  type StatusDoCredito,
} from '../types/hourCredit'

type CreditoStatusBadgeProps = {
  /** Valor **cru** do wire — a normalização acontece aqui dentro, uma vez só. */
  status: string | null | undefined
}

/**
 * Pílula de status do crédito (132/F5).
 *
 * As cores saem de pares `-bg`/`-fg` já medidos em AA no DOM
 * (`src/utils/primitivosDeUiContraste.test.tsx` cobre os mesmos pares usados pelo `Badge`;
 * `--color-error-fg` e `--color-warning-fg` foram escurecidos nas 123/125 justamente para
 * isso). Nenhum hex novo, nenhuma classe da paleta padrão do Tailwind
 * (`rules/frontend.md` § Contraste).
 *
 * 🔴 O status **não é recalculado no front** — é derivado no servidor
 * (`arquitetura.md:904`). Aqui só se traduz o token, e o token que esta versão não conhece
 * aparece **cru**, em cinza neutro: sem cor semântica e sem significado inventado
 * (`AP-API-002`).
 *
 * WCAG 1.4.1: a informação está no **texto**, não na cor — remover a classe de cor não
 * apaga o significado.
 */
const CLASSES_POR_STATUS: Record<StatusDoCredito, string> = {
  vigente: 'bg-success-bg text-success-fg',
  expirado: 'bg-badge-neutro-bg text-badge-neutro-fg',
  estornado: 'bg-error-bg text-error-fg',
}

const CLASSE_DESCONHECIDO = 'bg-badge-neutro-bg text-badge-neutro-fg'

export function CreditoStatusBadge({ status }: CreditoStatusBadgeProps) {
  const normalizado = normalizarStatusDoCredito(status)
  const rotulo = rotuloDoStatus(status)

  // `null`/ausente não vira pílula nenhuma: uma pílula cinza escrita "—" afirmaria um
  // estado que o servidor não mandou (`AP-FRONTEND-028`).
  if (status == null) return <span className="text-foreground/70">{rotulo}</span>

  return (
    <span
      data-status={normalizado}
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        normalizado === TOKEN_DESCONHECIDO
          ? CLASSE_DESCONHECIDO
          : CLASSES_POR_STATUS[normalizado],
      )}
    >
      {rotulo}
    </span>
  )
}
