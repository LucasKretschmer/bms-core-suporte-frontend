import { clsx } from 'clsx'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

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
 * variant="danger" → botão confirmar em vermelho (`Button` local `variant="danger"`),
 * role="alertdialog". Foco preso enquanto aberto. Escape fecha.
 * Foca o botão Cancelar ao abrir (padrão seguro para ações destrutivas).
 *
 * Permanece LOCAL (não compõe sobre o DS `Modal`): precisa de `role="alertdialog"`
 * em `variant="danger"` (o DS `Modal` sempre usa `role="dialog"`, sem opção de
 * alertdialog) e do foco automático no botão Cancelar — nenhum dos dois é
 * replicável compondo sobre o DS. Retematizado com os tokens Migrate
 * (`shadow-card`, `rounded-card`, `text-card`/`text-primary`) para bater com o DS
 * `Modal` (ver gap G6 do design system). Os botões usam o `Button` local (que já
 * encaminha ref e mapeia `variant="danger"` para o token `--color-error`).
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
          'relative z-10 w-full max-w-sm bg-white rounded-card shadow-card',
          'flex flex-col',
          className,
        )}
      >
        {/* Header — sem divisor (padrão DS: título "flutua") */}
        <div className="px-7 pt-5 pb-4">
          <h2 id={titleId} className="text-card font-medium text-primary">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-7 py-5">
          <p id={descriptionId} className="text-sm text-primary/70">
            {description}
          </p>
        </div>

        {/* Footer com botões */}
        <div className="flex items-center justify-between gap-3 px-7 pb-5">
          {/* Cancelar — alinhado à esquerda */}
          <Button ref={cancelButtonRef} variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>

          {/* Confirmar */}
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={isLoading}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
