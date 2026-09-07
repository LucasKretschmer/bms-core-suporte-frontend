/**
 * Seção de 1º Atendimento vs SLA do Dashboard Suporte.
 * Derivada dos campos respondidosNoPrazo / respondidosForaDoPrazo do MetricsOverviewDto.
 * Recebe valores prontos — sem chamada própria de API.
 * AP-SECURITY-001: labels "Atendidos no prazo" / "Atendidos fora do prazo" — sem categoria HubSpot.
 *
 * 124/P-7: o vocabulário desta seção é "1º atendimento" — as props e as chaves do DTO
 * continuam `respondidos*` (contrato de wire), o que o usuário lê é que mudou.
 *
 * ## 124/F4 — o que esta seção passou a impedir
 *
 * Os dois KPIs de SLA estavam MORTOS (gravados sempre `null`) e voltaram a viver com
 * `BE-F4F5`, agora calculados a partir da configuração local (plano + calendário). Com
 * as tabelas de configuração **vazias** — que é o estado em que o sistema entra em
 * produção, por decisão (`AUTO-124-8`) — a resposta continua `null`.
 *
 * Esse `null` tem DOIS significados que não podem compartilhar a mesma frase:
 * *"ainda não foi configurado"* e *"não há chamado no período"*. `supportSlaStates.ts`
 * os separa; aqui eles ganham textos e ações diferentes. O texto antigo
 * (*"Requer configuração no Service Hub"*) morreu junto com a fonte antiga: a
 * configuração passou a ser local (`/planos` e `/calendario`), e mandar o usuário ao
 * Service Hub seria mandá-lo ao lugar errado (`AP-FRONTEND-022`).
 *
 * ## E o aviso do FCR (`R-3`)
 *
 * O histórico de estágio é incompleto por construção, o que torna o FCR
 * **sistematicamente otimista**. Quando o período consultado começa antes de
 * `fcrHistoricoDesde`, o aviso aparece **acima do card**, visível (nunca em tooltip),
 * nomeando o indicador — porque o número do FCR mora no KPI, não neste card.
 *
 * ⚠️ Casa natural do aviso seria ao lado do KPI "FCR (1º contato)"
 * (`SupportKpiSection`/`kpiCatalog.ts`), fora do escopo desta unidade. Registrado no
 * `fe-f4-report.md`.
 */

import { Link } from '@tanstack/react-router'
import { FirstResponseVsSlaChart } from '../../shared/components/FirstResponseVsSlaChart'
import { ChartCard } from '../../shared/components/ChartCard'
import { usePermissions } from '../../../../hooks/usePermissions'
import type { DrillSpec } from '../../shared/types/metrics'
import {
  ACAO_SLA_NAO_CONFIGURADO,
  ACAO_SLA_NAO_CONFIGURADO_META,
  ACAO_SLA_NAO_CONFIGURADO_SEM_ACESSO,
  DETALHE_SLA_INDETERMINADO,
  DETALHE_SLA_SEM_CHAMADOS,
  TITULO_AVISO_FCR,
  TITULO_SLA_INDETERMINADO,
  TITULO_SLA_NAO_CONFIGURADO,
  TITULO_SLA_SEM_CHAMADOS,
  avisoDeHistoricoDoFcr,
  detalheSlaNaoConfigurado,
  estadoDoSla,
  textoDoAvisoDeHistoricoDoFcr,
} from './supportSlaStates'

type SupportSlaSectionProps = {
  respondidosNoPrazo: number | null
  respondidosForaDoPrazo: number | null
  /**
   * `ticketsAbertos` do MESMO overview — a cardinalidade do universo de elegibilidade
   * do SLA (mesmo recorte de `HsCriadoEm` e mesmo escopo). É o discriminador entre os
   * dois vazios; ver o cabeçalho de `supportSlaStates.ts`.
   */
  chamadosNoPeriodo?: number | null
  /** FCR do período (%). Sem número não há aviso de confiabilidade a dar. */
  fcr?: number | null
  /** `MIN(ticketstatushistory.mudouem)` ISO-8601 UTC (R-3). Ausente do JSON quando null. */
  fcrHistoricoDesde?: string | null
  /** `from` do filtro (`AAAA-MM-DD`) ou `null` (= mês corrente, default do backend). */
  periodoInicio?: string | null
  isLoading?: boolean
  isError?: boolean
  /**
   * 124/FE-P3 — texto do erro quando o servidor explicou o motivo (hoje só o
   * `422 DATE_RANGE_TOO_LARGE`: a janela pedida passa do teto). Ausente = o genérico de
   * sempre do `ErrorState`. Quem decide é a página, que é quem tem o objeto de erro do
   * `useMetricsOverview`.
   */
  errorMessage?: string
  onRetry?: () => void
  /** Drill (016): clique na fatia → tabela dos tickets daquele balde de SLA. */
  onSegmentDrill?: (spec: DrillSpec) => void
}

/** Classes do link para as telas de configuração — foco visível e alvo clicável claro. */
const CLASSE_LINK_DE_CONFIGURACAO =
  'rounded font-medium text-foreground underline underline-offset-2 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

export function SupportSlaSection({
  respondidosNoPrazo,
  respondidosForaDoPrazo,
  chamadosNoPeriodo,
  fcr,
  fcrHistoricoDesde,
  periodoInicio,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  onSegmentDrill,
}: SupportSlaSectionProps) {
  const { isGestor } = usePermissions()

  // Os dois vazios são decididos fora do componente (função pura, testada à parte).
  const estado = estadoDoSla({
    respondidosNoPrazo,
    respondidosForaDoPrazo,
    chamadosNoPeriodo,
  })

  // R-3: o aviso não depende do estado do SLA — ele qualifica OUTRO indicador e
  // continua visível mesmo com o card de SLA vazio, em erro ou carregando.
  const aviso = avisoDeHistoricoDoFcr({ fcr, fcrHistoricoDesde, periodoInicio })

  return (
    <>
      {aviso !== null && (
        <section
          aria-labelledby="aviso-fcr-historico-titulo"
          className="rounded-control border border-border bg-warning-bg px-3 py-2 text-sm text-foreground"
        >
          <h3 id="aviso-fcr-historico-titulo" className="font-medium">
            {TITULO_AVISO_FCR}
          </h3>
          <p className="mt-0.5">{textoDoAvisoDeHistoricoDoFcr(aviso.limiteFormatado)}</p>
        </section>
      )}

      <ChartCard
        title="1º Atendimento vs SLA"
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
        height={220}
      >
        {estado.tipo === 'ok' ? (
          <FirstResponseVsSlaChart
            respondidosNoPrazo={estado.noPrazo}
            respondidosForaDoPrazo={estado.foraDoPrazo}
            height={220}
            onSegmentClick={
              onSegmentDrill
                ? (sla) =>
                    onSegmentDrill({
                      metric: 'tickets-sla',
                      title:
                        sla === 'on'
                          ? 'Atendidos no prazo (SLA)'
                          : 'Atendidos fora do prazo',
                      params: { sla },
                    })
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            {/* 🔴 O `EmptyState` compartilhado NÃO é usado aqui, e medi o porquê: a
                mensagem dele é `text-xs italic text-primary/30` (bundle do design
                system, `dist/index.js:756`), que sobre o card mede **1,84:1** — muito
                abaixo do piso AA de 4,5:1. É o texto que ESTA unidade existe para
                fazer o gestor ler; renderizá-lo quase invisível anularia a entrega.
                Aqui o título é `text-foreground` sobre o card = **13,82:1**.
                O achado vale para TODOS os estados vazios do app e está registrado no
                `fe-f4-report.md` como candidato a demanda própria — corrigir o
                componente compartilhado está fora do escopo desta unidade. */}
            <p className="text-base font-medium text-foreground">
              {estado.tipo === 'nao-configurado'
                ? TITULO_SLA_NAO_CONFIGURADO
                : estado.tipo === 'sem-chamados'
                  ? TITULO_SLA_SEM_CHAMADOS
                  : TITULO_SLA_INDETERMINADO}
            </p>

            {/* text-foreground/70 sobre o card = 5.47:1 (AA). O padrão /50 do repo mede
                3.04:1 e REPROVA — achado de FE-F2F3, não repetido aqui. */}
            <p className="max-w-[70ch] text-sm text-foreground/70">
              {estado.tipo === 'nao-configurado'
                ? detalheSlaNaoConfigurado(estado.chamadosNoPeriodo)
                : estado.tipo === 'sem-chamados'
                  ? DETALHE_SLA_SEM_CHAMADOS
                  : DETALHE_SLA_INDETERMINADO}
            </p>

            {estado.tipo === 'nao-configurado' &&
              (isGestor ? (
                // Mesmo gate da Sidebar (`requiresGestor`): oferecer o caminho a quem
                // não pode entrar nele seria empurrar o usuário para um 403.
                // 124/FE-TXT — Calendário vem primeiro porque o expediente SÓ existe lá;
                // a meta aparece com as duas moradas que o backend aceita
                // (`MetricsService.cs:691` — plano ?? padrão do calendário).
                <p className="text-sm text-foreground">
                  {ACAO_SLA_NAO_CONFIGURADO}{' '}
                  <Link to="/calendario" className={CLASSE_LINK_DE_CONFIGURACAO}>
                    Calendário
                  </Link>
                  {ACAO_SLA_NAO_CONFIGURADO_META}{' '}
                  <Link to="/planos" className={CLASSE_LINK_DE_CONFIGURACAO}>
                    Planos
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-sm text-foreground">
                  {ACAO_SLA_NAO_CONFIGURADO_SEM_ACESSO}
                </p>
              ))}
          </div>
        )}
      </ChartCard>
    </>
  )
}
