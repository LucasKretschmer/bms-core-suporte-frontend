import { Button } from '../../../components/ui/Button'
import { useSyncTeams } from '../hooks/useSyncTeams'

type SyncTeamsButtonProps = {
  className?: string
}

const RefreshIcon = (
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
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
)

/**
 * Botão de sincronização de owners/equipes do HubSpot.
 * Encapsula a mutation — a página não precisa conhecer os detalhes.
 */
export function SyncTeamsButton({ className }: SyncTeamsButtonProps) {
  const mutation = useSyncTeams()

  return (
    <Button
      variant="secondary"
      isLoading={mutation.isPending}
      onClick={() => mutation.mutate()}
      icon={RefreshIcon}
      aria-label="Sincronizar equipes com HubSpot"
      className={className}
    >
      Sincronizar equipes
    </Button>
  )
}
