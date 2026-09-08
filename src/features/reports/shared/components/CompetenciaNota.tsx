/**
 * 123/FAT-1 — nota fixa que declara **por qual data** a tela recorta o período.
 *
 * Genérica de propósito: as duas telas de fatura (Consumo de Planos e Relatório do Cliente)
 * apuram pelo MESMO critério (`Ticket.FechadoEm`), e duas cópias do texto divergiriam na
 * primeira mudança de regra. Todo texto vem de `shared/utils/competenciaTexts.ts`, onde cada
 * afirmação está ancorada no `arquivo:linha` do backend que a sustenta (AP-FRONTEND-022).
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
  TEXTO_COMPETENCIA_PROJETO,
  TEXTO_COMPETENCIA_REGRA,
  TEXTO_COMPETENCIA_SEM_CONCLUSAO,
  TEXTO_COMPETENCIA_TITULO,
  TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
  textoPeriodoDeConclusao,
} from '../utils/competenciaTexts'

type CompetenciaNotaProps = {
  /** Período da tela (YYYY-MM-DD). `null` nas duas pontas = default do backend (mês atual). */
  from: string | null
  to: string | null
  /**
   * Declara também a exceção de PROJETO (que recorta pela data do apontamento).
   * Só faz sentido onde a tela mistura as duas origens numa coluna só — Consumo de Planos
   * (`ReportQueryRepository.cs:690-692`) e Relatório do Cliente (`:150-153`).
   */
  incluiProjeto?: boolean
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
  incluiProjeto = false,
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
        {incluiProjeto && <li>{TEXTO_COMPETENCIA_PROJETO}</li>}
        {comparaSaudePlanos && <li>{TEXTO_COMPETENCIA_VS_SAUDE_PLANOS}</li>}
      </ul>

      <p className="mt-2 text-xs font-medium text-foreground">
        {textoPeriodoDeConclusao({ from, to })}
      </p>
    </section>
  )
}
