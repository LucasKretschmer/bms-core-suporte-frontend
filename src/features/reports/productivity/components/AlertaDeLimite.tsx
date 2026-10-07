type AlertaDeLimiteProps = {
  texto: string
  detalhe?: string
}

/** Selo de alerta com ícone e texto, para não depender só da cor da linha. */
export function AlertaDeLimite({ texto, detalhe }: AlertaDeLimiteProps) {
  return (
    <span
      title={detalhe}
      className="inline-flex items-center gap-1 rounded-full bg-error-bg px-2 py-0.5 text-[11px] font-medium text-error-fg whitespace-nowrap"
    >
      <svg
        aria-hidden="true"
        className="h-3 w-3 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
      {texto}
      {detalhe && <span className="sr-only">{`: ${detalhe}`}</span>}
    </span>
  )
}
