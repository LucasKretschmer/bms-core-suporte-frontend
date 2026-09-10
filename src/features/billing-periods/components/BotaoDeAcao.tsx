import { clsx } from 'clsx'
import { useId } from 'react'

type BotaoDeAcaoProps = {
  children: React.ReactNode
  onClick: () => void
  /** Rótulo acessível completo (a célula tem só o verbo). */
  ariaLabel: string
  /**
   * `null` = ação disponível. Preenchido = ação **indisponível**, com o motivo.
   * O motivo é exibido no `title` e ligado por `aria-describedby` — é ele que responde
   * "por que este botão não faz nada?".
   */
  motivoIndisponivel?: string | null
  /** Bloqueio TEMPORÁRIO (requisição em andamento) — não é o mesmo que indisponível. */
  isPending?: boolean
  /** Cor do texto (token). Default: `text-primary`. */
  className?: string
}

const BASE =
  'text-xs font-medium rounded px-1 focus-visible:ring-2 focus-visible:ring-primary'

/**
 * Botão de ação da linha de competência.
 *
 * 🔴 **Ação indisponível continua alcançável pelo teclado e anunciada com o motivo**
 * (`rules/frontend.md` § Acessibilidade de teclado; mesmo desenho já usado no
 * `ariaDisabled` do `Switch`, 133). O `disabled` nativo tira o `<button>` da ordem de
 * tabulação **e do leitor de tela** — quem navega por teclado nunca alcançaria o controle
 * nem a explicação de por que ele não serve. Aqui a escrita é bloqueada com a mesma
 * dureza (o `onClick` não chama nada), mas o foco continua parando no botão.
 *
 * `disabled` de verdade fica reservado ao bloqueio **temporário** (`isPending`), onde não
 * há motivo a explicar — só esperar.
 */
export function BotaoDeAcao({
  children,
  onClick,
  ariaLabel,
  motivoIndisponivel = null,
  isPending = false,
  className,
}: BotaoDeAcaoProps) {
  const idMotivo = useId()
  const indisponivel = motivoIndisponivel != null

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-disabled={indisponivel || undefined}
        aria-describedby={indisponivel ? idMotivo : undefined}
        title={motivoIndisponivel ?? undefined}
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation()
          // Bloqueia a escrita tão de verdade quanto `disabled` — a diferença é só que o
          // controle continua focável e explicado.
          if (indisponivel || isPending) return
          onClick()
        }}
        className={clsx(
          BASE,
          indisponivel
            ? 'text-muted cursor-not-allowed'
            : clsx('hover:underline', className ?? 'text-primary'),
          isPending && 'opacity-50',
        )}
      >
        {children}
      </button>
      {indisponivel && (
        <span id={idMotivo} className="sr-only">
          {motivoIndisponivel}
        </span>
      )}
    </>
  )
}
