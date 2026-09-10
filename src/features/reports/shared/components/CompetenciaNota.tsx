/**
 * 123/FAT-1 — nota fixa que declara **por qual data** a tela recorta o período.
 *
 * Genérica de propósito: as duas telas de fatura (Consumo de Planos e Relatório do Cliente)
 * apuram a HORA pelo mesmo critério — e duas cópias do texto divergiriam na primeira mudança
 * de regra. **Foi o que aconteceu:** em 132/D1 o critério trocou de `Ticket.FechadoEm` para
 * `TimeEntry.InicioEm` nas duas telas, e a nota inteira mudou de conteúdo **sem uma linha de
 * componente** — porque o texto vive em `shared/utils/competenciaTexts.ts`, onde cada
 * afirmação está ancorada no `arquivo:linha` do backend que a sustenta (AP-FRONTEND-022).
 *
 * ⚠️ **Ressalva da 131 (08/09/2026): o PROJETO deixou de ser igual nas duas telas.** No
 * Consumo de Planos ele não consome mais o plano de suporte (região
 * `⟪131 PLANCONSUMO-HORASUSADAS⟫`, `ReportQueryRepository.cs:900-914`); no Relatório do
 * Cliente nada mudou. Por isso `notaDeProjeto` é uma união, não um booleano: a nota continua
 * compartilhada, mas a AFIRMAÇÃO sobre projeto é escolhida pelo call site. A 132 **não
 * revogou** a 131 — reancorado em 2026-09-09, com B1/B2 entregues.
 *
 * É informativa e **não interativa**: `<section>` semântica com `aria-label`, sem foco a
 * capturar e sem estado. Fica sempre visível (inclusive em loading/erro/vazio) quando
 * renderizada pelo slot `banner` do `ReportPageLayout` — esconder a explicação exatamente
 * quando a tela mostra zero é o silêncio que o relato B2 descreve.
 *
 * ⚠️ **Ressalva de 127/FE-AJUDA (08/09/2026) — vale para UMA das duas telas.** O parágrafo
 * acima continua descrevendo o **Relatório do Cliente** (`client-report/index.tsx:259`),
 * onde a nota segue aberta no `banner`. No **Consumo de Planos** ela passou a ficar
 * recolhida atrás do botão de ajuda `(?)` (`plan-consumption/components/PlanConsumptionHelp.tsx`),
 * por decisão do usuário: lá a nota somava com o card de exceções e empurrava a tabela
 * para baixo. O `(?)` continua no slot `banner` — portanto continua sobrevivendo aos
 * estados da listagem —, e é ele que carrega o indicador que impede o silêncio.
 * Este componente **não sabe** em qual dos dois modos está: quem decide é o call site.
 */

import { clsx } from 'clsx'
import {
  TEXTO_COMPETENCIA_CHAMADO_EM_ABERTO,
  TEXTO_COMPETENCIA_CONSEQUENCIA,
  TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS,
  TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE,
  TEXTO_COMPETENCIA_REGRA,
  TEXTO_COMPETENCIA_TITULO,
  TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
  textoPeriodoDeApontamento,
} from '../utils/competenciaTexts'

/**
 * 131 — o apontamento de projeto tem DOIS enquadramentos, um por tela, e por isso este
 * eixo deixou de ser booleano:
 *  · `'fora-do-plano'` — **Consumo de Planos**: projeto não consome o plano de suporte
 *    (região `⟪131 PLANCONSUMO-HORASUSADAS⟫`, `ReportQueryRepository.cs:900-914`);
 *  · `'no-plano-por-apontamento'` — **Relatório do Cliente**: nada mudou ali, projeto
 *    continua recortado por `InicioEm` (região `⟪121/A1 RAMO-PROJETO⟫`, `:172-205`) e
 *    somado em `PlanoSeg`. ⚠️ Depois da 132/D1 o ramo de TICKET daquela tela passou a usar
 *    a mesma data (`:119-170`) — o que esta opção afirma é sobre o PLANO, não sobre a data.
 *
 * Com um booleano as duas telas compartilhavam a MESMA frase — foi o que fez o texto
 * ficar falso em uma delas sem ficar falso na outra. A união obriga o call site a
 * escolher, e o `Record` abaixo obriga cada valor novo a trazer o seu texto.
 */
export type NotaDeProjeto = 'fora-do-plano' | 'no-plano-por-apontamento'

const TEXTO_DE_PROJETO: Record<NotaDeProjeto, string> = {
  'fora-do-plano': TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS,
  'no-plano-por-apontamento': TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE,
}

type CompetenciaNotaProps = {
  /** Período da tela (YYYY-MM-DD). `null` nas duas pontas = default do backend (mês atual). */
  from: string | null
  to: string | null
/**
   * Declara também o que acontece com o apontamento de PROJETO. Só faz sentido onde a tela
   * mistura as duas origens — Consumo de Planos (elegibilidade em
   * `ReportQueryRepository.cs:690-692`) e Relatório do Cliente (`:146-179`) —, e o VALOR
   * escolhido muda a afirmação, não só a visibilidade. Omitido = a nota não fala de projeto.
   */
  notaDeProjeto?: NotaDeProjeto
  /**
   * 123/FE-PER (D-14 / AUTO-1) — declara também que o gráfico **Saúde dos Planos** apura o
   * mesmo consumo — e 🔴 **132/F3: já NÃO é por outra data.** Os dois lados recortam por
   * `te.InicioEm` (`MetricsQueryRepository.cs:1471` × `ReportQueryRepository.cs:900-914`).
   * A frase continua necessária porque as telas divergem por OUTRAS razões, agora incluindo
   * o **crédito de horas**, que o `plan-health` não conhece (132/R-12,
   * `MetricsDtos.cs:137-148`).
   *
   * Só faz sentido onde o usuário compara os dois números — a tela de **Consumo de Planos**.
   * O Relatório do Cliente não tem contraparte no painel, e a frase ali seria ruído.
   */
  comparaSaudePlanos?: boolean
  className?: string
}

export function CompetenciaNota({
  from,
  to,
  notaDeProjeto,
  comparaSaudePlanos = false,
  className,
}: CompetenciaNotaProps) {
  return (
    <section
      aria-label={TEXTO_COMPETENCIA_TITULO}
      className={clsx('rounded-card border border-line bg-card shadow-card p-4', className)}
    >
      <h3 className="text-sm font-semibold text-foreground">{TEXTO_COMPETENCIA_TITULO}</h3>

      <p className="mt-1 text-xs text-foreground">{TEXTO_COMPETENCIA_REGRA}</p>

      <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
        <li>{TEXTO_COMPETENCIA_CONSEQUENCIA}</li>
        <li>{TEXTO_COMPETENCIA_CHAMADO_EM_ABERTO}</li>
        {notaDeProjeto && <li>{TEXTO_DE_PROJETO[notaDeProjeto]}</li>}
        {comparaSaudePlanos && <li>{TEXTO_COMPETENCIA_VS_SAUDE_PLANOS}</li>}
      </ul>

      <p className="mt-2 text-xs font-medium text-foreground">
        {textoPeriodoDeApontamento({ from, to })}
      </p>
    </section>
  )
}
