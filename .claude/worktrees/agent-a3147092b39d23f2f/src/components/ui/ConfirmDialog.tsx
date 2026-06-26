import { clsx } from 'clsx'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

type ConfirmDialogVariant = 'default' | 'danger'

type ConfirmDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  variant?: ConfirmDialogVariant
  className?: string
}

/**
 * Dialog de confirmação genérico — reutilizável em qualquer feature.
 * variant="danger" → botão confirmar em vermelho, role="alertdialog".
 * Foco preso enquanto aberto. Escape fecha.
 * Foca o botão Cancelar ao abrir (padrão seguro para ações destrutivas).
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isLoading = false,
  variant = 'default',
  className,
}: ConfirmDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const uid = useId()
  const descriptionId = `${uid}-desc`
  const titleId = `${uid}-title`

  useEffect(() => {
    if (!isOpen) return

    // Foca o botão Cancelar ao abrir (padrão seguro para ações destrutivas)
    cancelButtonRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Trap de foco: manter dentro do dialog
      if (e.key === 'Tab') {
        const container = containerRef.current
        if (!container) return
        const focusableEls = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (focusableEls.length === 0) return

        const firstEl = focusableEls[0]
        const lastEl = focusableEls[focusableEls.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault()
            lastEl.focus()
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault()
            firstEl.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
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
      role={variant === 'danger' ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Conteúdo */}
      <div
        ref={containerRef}
        className={clsx(
          'relative z-10 w-full max-w-sm bg-card rounded-2xl shadow-xl',
          'flex flex-col',
          className,
        )}
      >
        {/* Header */}
        <div className="px-7 pt-5 pb-4 border-b border-border">
          <h2 id={titleId} className="text-[16px] font-medium text-foreground">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 py-5">
          <p id={descriptionId} className="text-sm text-foreground/70">
            {description}
          </p>
        </div>

        {/* Footer com botões */}
        <div className="flex items-center justify-between gap-3 px-7 pb-5">
          {/* Cancelar — alinhado à esquerda */}
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className={clsx(
              'inline-flex items-center justify-center gap-2.5 h-9 px-3 py-2.5',
              'rounded-[5px] font-semibold text-sm',
              'bg-card text-foreground border border-border',
              'transition-shadow duration-150 cursor-pointer',
              'hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              isLoading && 'opacity-50 cursor-not-allowed pointer-events-none',
            )}
          >
            {cancelLabel}
          </button>

          {/* Confirmar */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading ? 'true' : undefined}
            className={clsx(
              'inline-flex items-center justify-center gap-2.5 h-9 px-3 py-2.5',
              'rounded-[5px] font-semibold text-sm',
              'transition-shadow duration-150 cursor-pointer',
              variant === 'danger'
                ? 'bg-error-fg text-white border border-error-fg'
                : 'bg-primary text-white border border-primary',
              'hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              isLoading && 'opacity-50 cursor-not-allowed pointer-events-none',
            )}
          >
            {isLoading ? (
              <>
                <svg
                  aria-hidden="true"
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>{confirmLabel}</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
