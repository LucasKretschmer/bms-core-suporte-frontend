import { clsx } from 'clsx'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import type { UnmatchedPlanDto } from '../types/supportPlan'
import { TITULO_UNMATCHED, textoResumoUnmatched } from '../utils/unmatchedTexts'

/**
 * 124/F1 — card "Planos do HubSpot sem correspondência".
 *
 * ## Por que ele existe (arquitetura §4 ponto 4, item 3)
 *
 * Quando o valor de `sla__plano_de_suporte_contratado` que o HubSpot manda não casa com
 * nenhum plano cadastrado, o cliente **não é reassociado** — o código preserva o plano
 * antigo de propósito (`IngestService.cs:809-810`) e o miss só produzia `LogDebug`
 * (`CompanySyncService.cs:338`), suprimido em produção. *"Um `Warning` num Cloud Run que
 * ninguém abre é quase tão inerte quanto um `Debug` suprimido"* — este card **é** o que
 * transforma o defeito de silencioso em visível.
 *
 * ## O card é SEMPRE renderizado, inclusive com a lista vazia
 *
 * Esconder no zero tornaria "nenhum valor sem correspondência" indistinguível de "a
 * requisição falhou" (AP-FRONTEND-021).
 *
 * ⚠️ Esta ressalva citava como irmã de desenho a
 * `plan-consumption/components/BillingExceptionsCard.tsx`, **apagada pela demanda 132**
 * (D7: com a competência vindo de `TimeEntry.InicioEm`, não existe mais "chamado fora de
 * qualquer fatura" para conferir). A referência foi removida em vez de reapontada porque
 * este card passou a ser o **único** exemplar vivo do padrão no repo — e um ponteiro para
 * arquivo inexistente manda o próximo leitor procurar o que não há. O princípio
 * (`AP-FRONTEND-021`) não depende do exemplo.
 */

type UnmatchedPlansCardProps = {
  itens: UnmatchedPlanDto[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  /**
   * Abre a criação de plano com o valor do HubSpot já preenchido. `undefined` quando o
   * usuário não tem permissão de criar (o `POST` exige GerentePlus) — a ação some, o
   * diagnóstico permanece.
   */
  onCriarPlano?: (valorHubspot: string) => void
  className?: string
}

function CardShell({
  children,
  tone = 'neutro',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutro' | 'alerta'
  className?: string
}) {
  return (
    <section
      aria-label={TITULO_UNMATCHED}
      className={clsx(
        'rounded-card border p-4',
        // O tom de alerta pinta o FUNDO (`warning-bg`) e mantém o texto em
        // `foreground` (13.36:1). Escolha da 124/FE-F1, quando `text-warning-fg` sobre
        // esse fundo media 3.00:1 e reprovava AA (AP-FRONTEND-018); o token foi
        // escurecido para `#a85800` em 125/FE-A11Y-3 e hoje mede 5.00:1.
        tone === 'alerta' ? 'border-border bg-warning-bg' : 'bg-card border-border shadow-card',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function UnmatchedPlansCard({
  itens,
  isLoading,
  isError,
  onRetry,
  onCriarPlano,
  className,
}: UnmatchedPlansCardProps) {
  if (isLoading) {
    return (
      <CardShell className={className}>
        <h2 className="text-sm font-semibold text-foreground">{TITULO_UNMATCHED}</h2>
        <div className="mt-3">
          <Skeleton lines={2} height="h-4" />
        </div>
      </CardShell>
    )
  }

  if (isError || itens == null) {
    return (
      <CardShell className={className}>
        <h2 className="text-sm font-semibold text-foreground">{TITULO_UNMATCHED}</h2>
        <ErrorState
          message="Não foi possível verificar os planos vindos do HubSpot."
          onRetry={onRetry}
        />
      </CardShell>
    )
  }

  if (itens.length === 0) {
    return (
      <CardShell className={className}>
        <h2 className="text-sm font-semibold text-foreground">{TITULO_UNMATCHED}</h2>
        {/* /70 sobre `bg-card` = 5,47:1. O /60 media 4,04:1 e reprovava AA (QA 124 D-3). */}
        <p className="mt-2 text-sm text-foreground/70">
          Todos os valores de plano recebidos do HubSpot correspondem a um plano cadastrado.
        </p>
      </CardShell>
    )
  }

  return (
    <CardShell tone="alerta" className={className}>
      <h2 className="text-sm font-semibold text-foreground">{TITULO_UNMATCHED}</h2>
      <p className="mt-1 text-sm text-foreground">{textoResumoUnmatched(itens)}</p>
      <p className="mt-1 text-xs text-foreground/70">
        Enquanto não houver correspondência, esses clientes mantêm o plano que já tinham — as horas
        contratadas podem estar erradas na fatura.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {itens.map((item) => (
          <li
            key={item.valorHubspot}
            className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground" title={item.valorHubspot}>
                {item.valorHubspot}
              </p>
              {/* /70 sobre o `bg-card` do item = 5,47:1 (o /60 media 4,04:1 — QA 124 D-3). */}
              <p className="text-xs text-foreground/70">
                {item.clientesAfetados === 1
                  ? '1 cliente afetado'
                  : `${item.clientesAfetados} clientes afetados`}
                {item.exemploClienteId != null && ` · ex.: cliente #${item.exemploClienteId}`}
              </p>
            </div>
            {onCriarPlano && (
              <Button
                variant="secondary"
                onClick={() => onCriarPlano(item.valorHubspot)}
                aria-label={`Criar plano para o valor ${item.valorHubspot}`}
              >
                Criar plano
              </Button>
            )}
          </li>
        ))}
      </ul>
    </CardShell>
  )
}
