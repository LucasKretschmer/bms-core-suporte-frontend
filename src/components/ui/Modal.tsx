import { clsx } from 'clsx'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { focaveisDentro } from './focusableElements'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: ModalSize
  className?: string
  /**
   * Intensidade do blur do backdrop. 'sm' (default) preserva o visual atual dos
   * modais existentes; 'lg' aplica um desfoque mais forte (opt-in) para previews
   * em tela quase cheia. Não altera outros usos do Modal.
   */
  backdropBlur?: 'sm' | 'lg'
}

/**
 * 'fullscreen' = quase tela cheia com 4% de margem em cada borda (92vw × 92vh).
 * Usado no preview de PDF (096). O body do modal usa flex-1 para preencher a altura.
 *
 * sm/md/lg alinhados ao DS `Modal` (max-w-md/max-w-lg/max-w-2xl). `xl` e
 * `fullscreen` são extensões locais — o DS não cobre esses tamanhos (gap G10
 * do design system: falta variante grande/tela cheia + blur configurável).
 */
const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
  fullscreen: 'w-[92vw] max-w-[92vw] h-[92vh] max-h-[92vh]',
}

/**
 * Modal genérico do app — retematizado com os tokens Migrate (`shadow-card`,
 * `rounded-card`, `text-card`/`text-primary`) para bater 1:1 com o DS `Modal`
 * nos tamanhos sm/md/lg.
 *
 * Permanece LOCAL (não é wrapper do DS `Modal`): o DS só tem `sm|md|lg` (até
 * `max-w-2xl`), overlay sempre `bg-black/40` sem blur configurável, e não
 * expõe `className` no painel. Produção usa `size="xl"`/`"fullscreen"` +
 * `backdropBlur="lg"` (preview de PDF quase-tela-cheia) — ver gap G10/G7 do
 * design system.
 *
 * O QUE ESTE COMPONENTE FAZ, exatamente (121/F2 — a docstring anterior dizia "trap de
 * foco" e o trap **não existia**; `Shift+Tab` saía do dialog e pousava no gatilho atrás
 * do overlay. Docstring que promete o que o código não entrega desliga a verificação —
 * ninguém confere o que já está escrito):
 *
 *  - **foco entra ao abrir**: no botão "Fechar modal" quando há `title`; sem `title`, no
 *    primeiro focável; sem nenhum focável, no próprio contêiner do dialog;
 *  - **`Tab` circula DENTRO do dialog**: do último volta ao primeiro, e `Shift+Tab` do
 *    primeiro vai ao último;
 *  - **`Escape` fecha** e **clique no overlay fecha**;
 *  - **scroll do body bloqueado** enquanto aberto.
 *
 * O QUE ELE NÃO FAZ:
 *
 *  - **não devolve o foco ao gatilho** — isso é de quem abre (guardar o `ref` do botão e
 *    refocá-lo no `onClose`; ver `BillingExceptionsCard.handleClose`). São dois
 *    mecanismos com donos diferentes: um teste só dá a impressão de cobrir os dois;
 *  - **não torna o resto da página inerte** (sem `inert`/`aria-hidden` no `body`): o
 *    trap é por tecla. Consequência conhecida: conteúdo dentro de `<iframe>` tem
 *    navegação própria — o `keydown` acontece no documento interno e não chega a este
 *    handler, então sair do iframe por `Tab` alcança a página de trás. O `Tab` DENTRO do
 *    iframe continua funcionando normalmente (o trap não interfere nele).
 *    **Isto continua verdade para este componente**: quem embute `<iframe>` fecha o ciclo
 *    do seu lado, com uma **sentinela de foco** logo depois do iframe (121/D21) — ver
 *    `ClientReportPdf`, que é o único consumidor com iframe, e `focusableElements.ts`,
 *    cuja noção de focável ele reusa. A alternativa (`inert` no `body`) foi **recusada**:
 *    deixaria inertes os portais de `Toast` e `ConfirmDialog`, que vivem fora do dialog;
 *  - **não interfere em conteúdo em portal** renderizado por dentro do modal (tooltip do
 *    `InfoIcon`, `Toast`, `ConfirmDialog`): o listener é NATIVO e vive no elemento do
 *    dialog, então só vê eventos de descendentes do DOM. Um `onKeyDown` do React
 *    capturaria os portais também — pelo caminho do React tree — e brigaria com eles.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
  backdropBlur = 'sm',
}: ModalProps) {
  const titleId = 'modal-title'
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    if (!dialog) return

    // Foco ENTRA no modal ao abrir: botão de fechar (quando há título) → primeiro
    // focável → o próprio dialog (`tabIndex={-1}` existe só para este caso).
    const alvoInicial = firstFocusableRef.current ?? focaveisDentro(dialog)[0] ?? dialog
    alvoInicial.focus()

    // Escape continua no DOCUMENTO, de propósito: se o foco escorregar para o `body`
    // (clique no overlay, elemento removido no meio do fluxo), um listener preso ao
    // dialog deixaria de fechar o modal — regressão em todos os consumidores.
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    /**
     * TRAP DE FOCO — listener NATIVO no elemento do dialog (nunca `document`, nunca
     * `onKeyDown` do React): assim ele só vê teclas de descendentes do DOM, e conteúdo
     * em portal (tooltip, toast, `ConfirmDialog`) segue com a navegação própria.
     *
     * Arrow function (e não `function`): declaração de função é hoistada, e o TS
     * descarta o estreitamento de `dialog` para não-nulo dentro dela.
     */
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focaveis = focaveisDentro(dialog)
      if (focaveis.length === 0) {
        // Modal sem nada focável: o foco fica no contêiner em vez de vazar.
        e.preventDefault()
        dialog.focus()
        return
      }

      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const ativo = document.activeElement

      if (e.shiftKey) {
        if (ativo === primeiro || ativo === dialog) {
          e.preventDefault()
          ultimo.focus()
        }
        return
      }
      if (ativo === ultimo || ativo === dialog) {
        e.preventDefault()
        primeiro.focus()
      }
    }


    document.addEventListener('keydown', handleEscape)
    dialog.addEventListener('keydown', handleTab)
    // Bloqueia scroll do body
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      dialog.removeEventListener('keydown', handleTab)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={dialogRef}
      /* `-1`: alvo de foco de último recurso (modal sem nada focável) e âncora do
         trap. Fica fora do ciclo do `Tab` — o seletor exclui `[tabindex="-1"]`. */
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Overlay */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/40',
          backdropBlur === 'lg' ? 'backdrop-blur-md' : 'backdrop-blur-sm',
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Conteúdo */}
      <div
        className={clsx(
          'relative z-10 w-full bg-white rounded-card shadow-card',
          'flex flex-col',
          size === 'fullscreen' && 'overflow-hidden',
          sizeClasses[size],
          className,
        )}
      >
        {/* Header — sem divisor (padrão DS: título "flutua" com px-7 pt-5) */}
        {title && (
          <div className="flex items-center justify-between px-7 pt-5 pb-4">
            <h2 id={titleId} className="text-card font-medium text-primary">
              {title}
            </h2>
            <button
              ref={firstFocusableRef}
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              className="text-primary/60 hover:text-primary transition-colors rounded focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2"
            >
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body com scroll interno. Em fullscreen, preenche a altura restante
            (flex-1, min-h-0) em vez de usar uma altura máxima fixa. */}
        <div
          className={clsx(
            'px-7 py-5 overflow-y-auto',
            size === 'fullscreen'
              ? 'flex-1 min-h-0'
              : 'max-h-[calc(100vh-160px)]',
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
