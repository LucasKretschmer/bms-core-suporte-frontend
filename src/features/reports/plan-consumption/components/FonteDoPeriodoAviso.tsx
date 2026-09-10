/**
 * 132/F4d (D12 · C-6 · C-7 · C-8) — o aviso de **origem dos números** do Consumo de Planos.
 *
 * ─── Onde ele vive, e por que não é em `children` ───────────────────────────────────────────
 *
 * No slot **`banner`** do `ReportPageLayout`, ao lado do `(?)`. O `ReportPageLayout` só
 * renderiza `children` no estado "com dados" — o aviso de mês fechado precisa sobreviver ao
 * vazio e ao erro, que é justamente quando o usuário pergunta "de onde vem esse número?". É a
 * mesma razão já escrita para o `(?)` em `index.tsx`.
 *
 * ─── WCAG 1.4.1 — o selo comunica por GLIFO + TEXTO, nunca por cor ─────────────────────────
 *
 * O 🔒 é `aria-hidden` e vem **sempre** acompanhado do rótulo "Competência fechada" em texto.
 * Removendo a classe de cor do nó, a informação continua inteira — travado por teste.
 *
 * ─── O botão de comparação ─────────────────────────────────────────────────────────────────
 *
 * Só com `fonte === 'snapshot'` **e** `isGerentePlus`. Ele **navega** para
 * `/competencias?competencia=YYYY-MM&comparar=1` em vez de abrir modal aqui: a comparação é
 * paginada, tem filtro por cliente e é `GerentePlus` — embutir uma segunda tabela paginada
 * nesta tela duplicaria estado de paginação numa página que já tem drawer. A rota de destino
 * **já declara o `validateSearch`** desses dois parâmetros (`routes/_auth/competencias.tsx`),
 * então o link não é descartado em silêncio (AP-FRONTEND-019).
 *
 * ⚠️ **Este componente não decide a fonte.** Ele recebe o envelope e delega a
 * `derivarEstadoDoPeriodo`. Nenhuma data entra aqui como insumo de decisão — só como texto a
 * formatar (`competencia`, `competenciaFechadaEm`, vindos do payload). A proibição é travada
 * na AST por `fonteDoPeriodo.estrutural.test.ts`.
 */

import { useNavigate } from '@tanstack/react-router'
import { formatDate, formatMonth } from '../../shared/utils/formatters'
import { usePermissions } from '../../../../hooks/usePermissions'
import {
  GLIFO_FECHADA,
  ROTULO_COMPARAR,
  ROTULO_REGIAO_FONTE,
  SELO_FECHADA,
  TEXTO_ANTERIOR_AO_CONGELAMENTO,
  TEXTO_CREDITO_ZERADO_NAO_MENSAL,
  TEXTO_PERIODO_PERSONALIZADO,
  derivarEstadoDoPeriodo,
  textoAoVivo,
  textoFechada,
  textoRefechada,
} from '../fonteDoPeriodoTextos'
import type { PlanConsumptionResponseDto } from '../../shared/types/reports'

type FonteDoPeriodoAvisoProps = {
  /**
   * O envelope da resposta, ou `undefined` enquanto a query não resolveu. `undefined` e
   * envelope sem `fonte` produzem **o mesmo nada** — os dois são "não sei".
   */
  envelope:
    | Pick<
        PlanConsumptionResponseDto,
        | 'fonte'
        | 'competencia'
        | 'competenciaFechadaEm'
        | 'competenciaVersao'
        | 'avisoPeriodoNaoMensal'
        | 'avisoAnteriorAoCongelamento'
      >
    | undefined
}

/** `"YYYY-MM"` → "Agosto 2026". Fora do escopo do módulo de textos: formatação é do projeto. */
function mesLegivel(competencia: string | null | undefined): string {
  if (competencia == null || competencia === '') return 'do período'
  return formatMonth(competencia)
}

export function FonteDoPeriodoAviso({ envelope }: FonteDoPeriodoAvisoProps) {
  const { isGerentePlus } = usePermissions()
  const navigate = useNavigate()

  if (envelope == null) return null

  const estado = derivarEstadoDoPeriodo(envelope)
  if (estado === 'desconhecida') return null

  const mes = mesLegivel(envelope.competencia)
  const fechadaEm = envelope.competenciaFechadaEm
    ? formatDate(envelope.competenciaFechadaEm)
    : null
  const versao = envelope.competenciaVersao ?? 1
  const podeComparar = estado === 'fechada' && isGerentePlus && envelope.competencia != null

  return (
    <section
      aria-label={ROTULO_REGIAO_FONTE}
      className="rounded-card border border-line bg-card shadow-card p-4 flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      {estado === 'fechada' && (
        <>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
            <span aria-hidden="true">{GLIFO_FECHADA}</span>
            {SELO_FECHADA}
          </span>
          <p className="text-xs text-muted">{textoFechada(mes, fechadaEm)}</p>
          {versao > 1 && <p className="text-xs text-muted">{textoRefechada(versao)}</p>}
          {podeComparar && (
            <button
              type="button"
              className="text-xs font-medium text-primary underline underline-offset-2 rounded-control focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() =>
                void navigate({
                  to: '/competencias',
                  search: { competencia: envelope.competencia ?? undefined, comparar: '1' },
                })
              }
            >
              {ROTULO_COMPARAR}
            </button>
          )}
        </>
      )}

      {estado === 'aovivo' && <p className="text-xs text-muted">{textoAoVivo(mes)}</p>}

      {estado === 'periodo-personalizado' && (
        <>
          <p className="text-xs text-muted">{TEXTO_PERIODO_PERSONALIZADO}</p>
          {/* D20 — a frase que liga o aviso ao crédito zerado. Sem ela, o usuário conclui
              que o crédito desapareceu. */}
          <p className="text-xs text-muted">{TEXTO_CREDITO_ZERADO_NAO_MENSAL}</p>
        </>
      )}

      {estado === 'anterior-ao-congelamento' && (
        <p className="text-xs text-muted">{TEXTO_ANTERIOR_AO_CONGELAMENTO}</p>
      )}
    </section>
  )
}
