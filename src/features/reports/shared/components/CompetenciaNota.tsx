/**
 * 123/FAT-1 — nota fixa que declara **por qual data** a tela recorta o período.
 *
 * Genérica de propósito: as duas telas de fatura (Consumo de Planos e Relatório do Cliente)
 * apuram o CHAMADO pelo mesmo critério (`Ticket.FechadoEm`), e duas cópias do texto
 * divergiriam na primeira mudança de regra. Todo texto vem de
 * `shared/utils/competenciaTexts.ts`, onde cada afirmação está ancorada no `arquivo:linha`
 * do backend que a sustenta (AP-FRONTEND-022).
 *
 * ⚠️ **Ressalva da 131 (08/09/2026): o PROJETO deixou de ser igual nas duas telas.** No
 * Consumo de Planos ele não consome mais o plano de suporte
 * (`ReportQueryRepository.cs:771-786`); no Relatório do Cliente nada mudou (`:146-179`,
 * `:210`). Por isso `notaDeProjeto` é uma união, não um booleano: a nota continua
 * compartilhada, mas a AFIRMAÇÃO sobre projeto é escolhida pelo call site.
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
  TEXTO_COMPETENCIA_CONSEQUENCIA,
  TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS,
  TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE,
  TEXTO_COMPETENCIA_REGRA,
  TEXTO_COMPETENCIA_SEM_CONCLUSAO,
  TEXTO_COMPETENCIA_TITULO,
  TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
  textoPeriodoDeConclusao,
} from '../utils/competenciaTexts'

/**
 * 131 — o apontamento de projeto tem DOIS enquadramentos, um por tela, e por isso este
 * eixo deixou de ser booleano:
 *  · `'fora-do-plano'` — **Consumo de Planos**: projeto não consome o plano de suporte
 *    (`ReportQueryRepository.cs:771-786`, região `⟪131 PLANCONSUMO-HORASUSADAS⟫`);
 *  · `'no-plano-por-apontamento'` — **Relatório do Cliente**: nada mudou ali, projeto
 *    continua recortado por `InicioEm` (`:146-179`) e somado em `PlanoSeg` (`:210`).
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
   * mesmo consumo por OUTRA data (a do apontamento, `MetricsQueryRepository.cs:1264-1265`),
   * de propósito: é o medidor ao vivo que o usuário pediu.
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
        <li>{TEXTO_COMPETENCIA_SEM_CONCLUSAO}</li>
        {notaDeProjeto && <li>{TEXTO_DE_PROJETO[notaDeProjeto]}</li>}
        {comparaSaudePlanos && <li>{TEXTO_COMPETENCIA_VS_SAUDE_PLANOS}</li>}
      </ul>

      <p className="mt-2 text-xs font-medium text-foreground">
        {textoPeriodoDeConclusao({ from, to })}
      </p>
    </section>
  )
}
