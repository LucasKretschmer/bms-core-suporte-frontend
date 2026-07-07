/**
 * Loader full-screen para o estado "carregando sessão" (rehydrate via refresh no F5).
 *
 * Acessível: role="status" + aria-live="polite" + texto "Carregando…".
 * Usa tokens do design system (bg-background, text-foreground) — sem hex hardcoded.
 */
export function FullPageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary-light"
      />
      <span className="text-sm text-muted">Carregando…</span>
    </div>
  )
}
