import { clsx } from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'

type InfoIconProps = {
  tooltip: string
  className?: string
}

/**
 * Ícone ⓘ com tooltip acessível.
 * Fundo preto, texto branco. Acessível por teclado (Tab + focus).
 */
export function InfoIcon({ tooltip, className }: InfoIconProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const tooltipId = useId()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <span className={clsx('relative inline-flex items-center', className)}>
      <button
        ref={ref}
        type="button"
        aria-label={tooltip}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded-full leading-none"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap bg-black text-white text-xs rounded px-2 py-1 shadow-lg pointer-events-none"
        >
          {tooltip}
          {/* Seta */}
          <span
            aria-hidden="true"
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"
          />
        </span>
      )}
    </span>
  )
}
