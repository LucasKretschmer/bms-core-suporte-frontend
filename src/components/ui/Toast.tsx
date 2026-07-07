import { clsx } from 'clsx'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
  id: string
  type: ToastType
  message: string
}

type ToastContextValue = {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toastStyles: Record<ToastType, string> = {
  success: 'bg-success-bg text-success-fg border-success-fg/30',
  error:   'bg-error-bg text-error-fg border-error-fg/30',
  info:    'bg-info-bg text-info-fg border-info-fg/30',
}

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

let toastCounter = 0

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-card border shadow-panel',
            'text-sm font-medium',
            // height conforme frontend.md (alertas): h-[60px]
            'min-h-[60px]',
            toastStyles[t.type],
          )}
        >
          <span aria-hidden="true">{toastIcons[t.type]}</span>
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Fechar notificação"
            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = String(++toastCounter)
      setToasts((prev) => [...prev, { id, type, message }])
      // Auto-dismiss após 4s
      const timer = setTimeout(() => dismiss(id), 4000)
      timersRef.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    // Limpa timers ao desmontar
    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  const toast = {
    success: (message: string) => add('success', message),
    error:   (message: string) => add('error', message),
    info:    (message: string) => add('info', message),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

/** Hook para disparar toasts de qualquer lugar. */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx.toast
}
