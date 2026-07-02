import { clsx } from 'clsx'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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
 */
const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
  fullscreen: 'w-[92vw] max-w-[92vw] h-[92vh] max-h-[92vh]',
}

/**
 * Modal do Design System BMS.
 * Cantos 16px, padding lateral 28px, padding topo/base 20px.
 * Trap de foco, Escape fecha, overlay clica-para-fechar.
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
  const firstFocusableRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Foca o botão de fechar ao abrir
    firstFocusableRef.current?.focus()

    // Fecha com Escape
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    // Bloqueia scroll do body
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
          'relative z-10 w-full bg-card rounded-2xl shadow-xl',
          'flex flex-col',
          size === 'fullscreen' && 'overflow-hidden',
          sizeClasses[size],
          className,
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-7 pt-5 pb-4 border-b border-border">
            <h2 id={titleId} className="text-[16px] font-medium text-foreground">
              {title}
            </h2>
            <button
              ref={firstFocusableRef}
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              className="text-muted hover:text-foreground transition-colors rounded focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
