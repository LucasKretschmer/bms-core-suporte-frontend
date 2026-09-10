import { clsx } from 'clsx'

export type TomDaAcao = 'primary' | 'danger'

/**
 * Bloqueio de uma ação de linha: **o motivo é obrigatório**, e o `id` aponta para o
 * elemento **visível** que o exibe. Os dois juntos no mesmo objeto de propósito — um tipo
 * que permitisse bloquear sem motivo permitiria escrever o defeito que este componente
 * existe para impedir.
 */
export type BloqueioDaAcao = {
  /** Frase exibida ao usuário, também usada no `title`. */
  motivo: string
  /** `id` do nó que exibe `motivo` na tela — alvo do `aria-describedby`. */
  motivoId: string
}

type AcaoDeTabelaProps = {
  /** Texto do botão (`editar`, `excluir`). */
  children: React.ReactNode
  /** Rótulo acessível completo, com o nome do registro. */
  'aria-label': string
  onClick: () => void
  tom?: TomDaAcao
  /** Presente ⇒ ação bloqueada. Ausente/`null` ⇒ ação normal. */
  bloqueio?: BloqueioDaAcao | null
}

const classesPorTom: Record<TomDaAcao, string> = {
  primary: 'text-primary',
  danger: 'text-error-fg',
}

const classeBase =
  'text-xs font-medium rounded px-1 focus-visible:ring-2 focus-visible:ring-primary'

/**
 * Botão de ação de linha de tabela, com bloqueio **anunciado**.
 *
 * 🔴 Ação bloqueada usa **`aria-disabled`, nunca o `disabled` mudo**
 * (`rules/frontend.md` § Acessibilidade de teclado, promovida de `AP-QA-007`):
 *
 * - `disabled` **remove o botão da ordem de tabulação**. Quem navega por teclado ou por
 *   leitor de tela simplesmente **não encontra** o controle, e nunca fica sabendo que a
 *   ação existe nem por que não pode usá-la — some da tela sem explicação.
 * - `aria-disabled="true"` mantém o botão focável e anunciado como indisponível, e o
 *   `aria-describedby` leva o leitor **ao motivo**, que está visível na própria célula.
 *
 * O clique é neutralizado aqui dentro (o `onClick` do chamador não é invocado) — sem isso,
 * "bloqueado" seria só aparência, e o `aria-disabled` mentiria.
 *
 * Reutilizado pelas duas telas da 132/F5-F6: Motivos (motivo semeado, `409
 * MOTIVO_DE_SISTEMA`) e Créditos (crédito estornado, `409 CREDITO_ESTORNADO`) — nos dois
 * casos o servidor **recusa** a operação, então a UI recusa antes, dizendo por quê.
 */
export function AcaoDeTabela({
  children,
  'aria-label': ariaLabel,
  onClick,
  tom = 'primary',
  bloqueio = null,
}: AcaoDeTabelaProps) {
  const bloqueada = bloqueio !== null

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={bloqueada || undefined}
      aria-describedby={bloqueio?.motivoId}
      title={bloqueio?.motivo}
      onClick={(e) => {
        e.stopPropagation()
        // Bloqueio real, não decorativo: sem este retorno o `aria-disabled` afirmaria uma
        // indisponibilidade que o clique desmente.
        if (bloqueada) return
        onClick()
      }}
      className={clsx(
        classeBase,
        classesPorTom[tom],
        bloqueada ? 'opacity-60 cursor-not-allowed' : 'hover:underline',
      )}
    >
      {children}
    </button>
  )
}
