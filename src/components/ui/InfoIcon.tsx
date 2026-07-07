import { clsx } from 'clsx'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type InfoIconProps = {
  tooltip: string
  className?: string
}

type TooltipPosition = {
  /** left absoluto (px) do centro do balão na viewport */
  left: number
  /** top absoluto (px) do balão na viewport */
  top: number
  /** Se o balão foi posicionado abaixo do ícone (seta invertida) */
  below: boolean
}

/** Distância vertical entre o ícone e o balão (px). */
const GAP = 8
/** Margem mínima da borda da viewport para clamp horizontal (px). */
const VIEWPORT_MARGIN = 8

/**
 * Ícone ⓘ com tooltip acessível.
 *
 * O balão é renderizado via portal em `document.body` com `position: fixed`,
 * calculado a partir do `getBoundingClientRect()` do botão. Isso evita que o
 * balão seja clipado por ancestrais com `overflow` (ex.: scroll horizontal da
 * DataTable) ou coberto por stacking contexts do cabeçalho.
 *
 * - Preferência: acima do ícone, centralizado. Cai para baixo se não couber.
 * - z-index de tooltip acima de modais/dropdowns (z-50) e abaixo do toast
 *   (z-100), consistente com a escala do design system.
 * - Acessível: `role="tooltip"`, `aria-describedby` quando visível, hover
 *   (mouseenter/leave) e teclado (focus/blur), `aria-label` no botão.
 * - Reposiciona em `scroll`/`resize` enquanto visível; listeners limpos no
 *   unmount.
 */
export function InfoIcon({ tooltip, className }: InfoIconProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const tooltipEl = tooltipRef.current
    const tooltipHeight = tooltipEl?.offsetHeight ?? 0
    const tooltipWidth = tooltipEl?.offsetWidth ?? 0

    const centerX = rect.left + rect.width / 2

    // Preferir acima; se não couber, posicionar abaixo.
    const spaceAbove = rect.top
    const fitsAbove = spaceAbove >= tooltipHeight + GAP
    const below = !fitsAbove

    const top = below ? rect.bottom + GAP : rect.top - tooltipHeight - GAP

    // Clamp horizontal para não sair da viewport (mantém centralização quando cabe).
    const half = tooltipWidth / 2
    const minLeft = VIEWPORT_MARGIN + half
    const maxLeft = window.innerWidth - VIEWPORT_MARGIN - half
    const left = tooltipWidth > 0 ? Math.min(Math.max(centerX, minLeft), maxLeft) : centerX

    setPosition({ left, top, below })
  }, [])

  // Calcula a posição de forma síncrona após montar o balão (mede dimensões reais).
  useLayoutEffect(() => {
    if (visible) updatePosition()
  }, [visible, updatePosition])

  // Reposiciona em scroll/resize enquanto visível; limpa no unmount/ocultar.
  useEffect(() => {
    if (!visible) return
    const handle = () => updatePosition()
    window.addEventListener('scroll', handle, true)
    window.addEventListener('resize', handle)
    return () => {
      window.removeEventListener('scroll', handle, true)
      window.removeEventListener('resize', handle)
    }
  }, [visible, updatePosition])

  const show = useCallback(() => setVisible(true), [])
  const hide = useCallback(() => setVisible(false), [])

  // Defesa em profundidade: o clique/pointerdown no ícone nunca deve borbulhar
  // para elementos clicáveis ao redor (ex.: cabeçalho de ordenação da tabela ou
  // linha clicável). O ícone apenas exibe o tooltip — não executa ação alguma.
  const stopClick = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }, [])

  return (
    <span className={clsx('inline-flex items-center', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={tooltip}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={stopClick}
        onPointerDown={stopClick}
        className="text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2 rounded-full leading-none"
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
      {visible &&
        createPortal(
          <span
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={{
              left: position?.left ?? -9999,
              top: position?.top ?? -9999,
            }}
            className={clsx(
              'fixed z-[60] -translate-x-1/2 whitespace-nowrap rounded-control bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg pointer-events-none',
              // Enquanto a posição não foi medida, mantém invisível para evitar flash.
              position ? 'visible' : 'invisible',
            )}
          >
            {tooltip}
            <span
              aria-hidden="true"
              className={clsx(
                'absolute left-1/2 -translate-x-1/2 border-4 border-transparent',
                position?.below
                  ? 'bottom-full border-b-ink'
                  : 'top-full border-t-ink',
              )}
            />
          </span>,
          document.body,
        )}
    </span>
  )
}
