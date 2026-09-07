import { clsx } from 'clsx'
import { Button } from './Button'

type EmptyStateProps = {
  /** A frase principal do vazio — o que não existe. Sempre legível (AA). */
  message: string
  /** Explicação da consequência / do próximo passo. Opcional. */
  description?: React.ReactNode
  /** Ícone decorativo. O padrão é a bandeja abaixo. */
  icon?: React.ReactNode
  /** Ação primária, renderizada como botão secundário. */
  action?: { label: string; onClick: () => void }
  /** Conteúdo extra (links, texto de ação com navegação) abaixo da descrição. */
  children?: React.ReactNode
  className?: string
  /**
   * `role="status"` na região — anuncia o vazio a leitores de tela quando ele
   * SUBSTITUI um carregamento. Fora desse caso, deixar `false` evita anúncio
   * duplicado de conteúdo que já estava na tela.
   */
  announce?: boolean
}

/**
 * Estado vazio — nunca deixar a tela em branco sem feedback.
 *
 * ## 🔴 Por que este componente NÃO delega mais ao `EmptyState` do design system
 *
 * 125/FE-A11Y-1. O `EmptyState` de `@migrate/design-system` renderiza a mensagem num
 * `<p>` **interno** com `text-xs italic text-primary/30`
 * (`node_modules/@migrate/design-system/dist/index.js:756`). Sobre `--color-card`
 * (#ffffff) isso compõe #b3c1ca e mede **1,84:1** — menos da metade do piso AA de
 * 4,5:1. Medido no DOM renderizado por três unidades independentes da demanda 124
 * (`FE-F4` §7, `FE-TXT` §6, QA `D-2`).
 *
 * O `className` do wrapper vai para o `<div>` de fora e **não alcança** esse `<p>`:
 * passar classe por fora não corrige nada (é isso que fez o defeito atravessar três
 * unidades sem ser visto). E o design system é um **tarball vendorizado**
 * (`file:./vendor/migrate-design-system-0.1.0.tgz`) — o fonte dele não está neste
 * workspace, então corrigir "no componente compartilhado" não é opção.
 *
 * Sobrou renderizar a mensagem **aqui**, onde a classe é visível para quem lê a tela,
 * para o code review e para a trava de contraste
 * (`src/utils/primitivosDeUiContraste.test.tsx`). A alternativa — um override
 * de CSS com especificidade no `global.css` — foi descartada: ela conserta o pixel mas
 * é **invisível** para qualquer medição baseada no que o elemento renderiza (em jsdom
 * não há CSS aplicado), e obrigaria a trava a manter à mão uma exceção do tipo "esta
 * classe reprova, mas tem um override em outro arquivo" — exatamente a enumeração à mão
 * que `rules/security.md` proíbe.
 *
 * O layout (flex coluna, centralizado, `px-6 py-12`, ícone decorativo) é o mesmo do DS;
 * o que muda é de quem é o `<p>` e qual token ele usa.
 *
 * ## Contrastes medidos (WCAG 2.x, `src/utils/colorContrast.ts`)
 *
 * | Elemento | Classe | sobre `--color-card` | sobre `--color-background` |
 * |---|---|---|---|
 * | mensagem | `text-foreground` | **13,82:1** | 12,50:1 |
 * | descrição | `text-foreground/70` | **5,47:1** | 5,20:1 |
 *
 * Os números são medidos em runtime pela trava citada acima — nunca digitados.
 */
export function EmptyState({
  message,
  description,
  icon,
  action,
  children,
  className,
  announce = false,
}: EmptyStateProps) {
  return (
    <div
      role={announce ? 'status' : undefined}
      className={clsx(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      <span aria-hidden="true" className="text-muted">
        {icon ?? <EmptyStateIcon />}
      </span>

      <p className="text-base font-medium text-foreground">{message}</p>

      {description !== undefined && (
        <p className="max-w-[70ch] text-sm text-foreground/70">{description}</p>
      )}

      {children}

      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

/**
 * Bandeja vazia — ícone puramente decorativo (`aria-hidden` no `<span>` que o
 * envolve); o significado vem da `message`. Desenhado aqui em vez de importado de
 * `lucide-react`: esse pacote é dependência **transitiva** do design system, e `src/`
 * não o importa em lugar nenhum (`ExternalLinkIcon.tsx` segue o mesmo padrão de SVG
 * local). `currentColor` faz a cor vir do `text-*` de quem o renderiza.
 */
function EmptyStateIcon() {
  return (
    <svg
      className="size-10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d="M3.5 13.5h4l1.5 2.25h6l1.5-2.25h4" />
      <path d="M5 6.6 3.5 13.5v3.25A1.75 1.75 0 0 0 5.25 18.5h13.5a1.75 1.75 0 0 0 1.75-1.75V13.5L19 6.6a1.75 1.75 0 0 0-1.7-1.35H6.7A1.75 1.75 0 0 0 5 6.6Z" />
    </svg>
  )
}
