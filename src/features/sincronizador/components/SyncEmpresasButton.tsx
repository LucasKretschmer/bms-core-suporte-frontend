import { Button } from '../../../components/ui/Button'
import { useSyncEmpresas } from '../hooks/useSyncEmpresas'

type SyncEmpresasButtonProps = {
  className?: string
}

const BuildingIcon = (
  <svg
    aria-hidden="true"
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5"
    />
  </svg>
)

/**
 * Botão provisório (081) de sincronização de EMPRESAS do HubSpot.
 * Processo dedicado e separado do sync de tickets: create + update +
 * soft-delete das removidas. Encapsula a mutation — a página só renderiza.
 */
export function SyncEmpresasButton({ className }: SyncEmpresasButtonProps) {
  const mutation = useSyncEmpresas()

  return (
    <Button
      variant="secondary"
      isLoading={mutation.isPending}
      onClick={() => mutation.mutate()}
      icon={BuildingIcon}
      aria-label="Sincronizar empresas com HubSpot"
      className={className}
    >
      Sincronizar empresas
    </Button>
  )
}
