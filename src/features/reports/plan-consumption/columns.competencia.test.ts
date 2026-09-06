/**
 * 123/FAT-1 — os `headerInfo` das colunas de horas do Consumo de Planos declaram POR QUAL
 * DATA o período recorta.
 *
 * Por que este arquivo existe: os tooltips diziam genericamente "no período". Quem filtrava
 * julho, via 0 h e sabia que tinha apontado 2 h em julho concluía que o sistema perdeu o
 * dado — é o relato B2 literal. O número está certo pela regra vigente desde a 121
 * (`Ticket.FechadoEm`, `ReportQueryRepository.cs:686-689,759-798`); o que faltava era a tela
 * dizê-lo.
 *
 * O que deixa cada asserção VERMELHA:
 *  · revert de qualquer um dos 5 tooltips para a redação genérica ("no período" sem dizer
 *    qual data) → o assert de `/conclu/` cai;
 *  · retorno do jargão de banco/código (`billableOutsidePlan`, `FechadoEm`, `InicioEm`,
 *    `Ticket.`) → o assert de jargão cai;
 *  · coluna de horas NOVA sem tooltip de competência → o assert de identidade do conjunto
 *    cai, nomeando a coluna;
 *  · coluna que HOJE tem tooltip perdendo o `headerInfo` → mesmo assert.
 */

import { describe, expect, it } from 'vitest'
import { planConsumptionColumns } from './columns'
import {
  TOOLTIP_HORAS_ADICIONAIS,
  TOOLTIP_HORAS_ANALISE,
  TOOLTIP_HORAS_FATURAVEIS,
  TOOLTIP_HORAS_RESTANTES,
  TOOLTIP_HORAS_USADAS,
} from '../shared/utils/competenciaTexts'

/**
 * As colunas cujo valor é APURADO pelo recorte de período — allowlist NOMINAL, item a item,
 * com a âncora do predicado ao lado. Nunca padrão de nome (`key.startsWith('horas')`): um
 * `horasXpto` novo entraria na varredura só por causa do nome, e um `consumoDoPlano` ficaria
 * de fora sem nada reprovar (`rules/security.md` § "exclusão é allowlist nominal").
 *
 * Fora da lista, e por quê:
 *  · `cnpj`/`nomeFantasia`/`razaoSocial`/`nomePlano` — cadastro, não apuram nada;
 *  · `qtdePlanoHoras` — o contratado do plano, não depende do período;
 *  · `percentualPlano` — razão entre duas colunas que já declaram o recorte.
 */
const COLUNAS_APURADAS: Record<string, string> = {
  // `HorasUsadasSeg`, parcela ticket por `Ticket.FechadoEm` (`:759-763`).
  horasUsadas: TOOLTIP_HORAS_USADAS,
  // Derivada de `horasUsadas` (`qtdePlano − usadas`) — herda o recorte.
  horasRestantes: TOOLTIP_HORAS_RESTANTES,
  // Derivada de `horasUsadas` (excedente) — herda o recorte.
  horasAdicionais: TOOLTIP_HORAS_ADICIONAIS,
  // `HorasFaturaveisSeg`, parcela ticket por `Ticket.FechadoEm` (`:775-779`).
  horasFaturaveis: TOOLTIP_HORAS_FATURAVEIS,
  // `HorasAnaliseSeg`, ticket-only por `Ticket.FechadoEm` (`:793-798`).
  horasAnalise: TOOLTIP_HORAS_ANALISE,
}

function headerInfoDe(key: string): string | undefined {
  return planConsumptionColumns.find((c) => c.key === key)?.headerInfo
}

describe('Consumo de Planos — colunas de horas declaram o recorte por conclusão', () => {
  it('o conjunto de colunas COM headerInfo é nominalmente o das colunas apuradas', () => {
    // Identidade nas duas direções, derivada da fonte real (o array de colunas):
    //  · coluna apurada nova sem tooltip → falta aqui e o teste a NOMEIA;
    //  · coluna de cadastro ganhando tooltip de competência → sobra aqui.
    // Cardinalidade sozinha passaria com uma entrando e outra saindo.
    const comTooltip = planConsumptionColumns
      .filter((c) => c.headerInfo !== undefined)
      .map((c) => c.key)
    expect(new Set(comTooltip)).toEqual(new Set(Object.keys(COLUNAS_APURADAS)))
  })

  it.each(Object.entries(COLUNAS_APURADAS))(
    'coluna %s usa o texto ancorado e fala de conclusão',
    (key, textoEsperado) => {
      const info = headerInfoDe(key)
      // Literal vindo do módulo de textos (que tem o próprio teste com literais escritos à
      // mão) — não é tautologia: aqui se prova o LIGAMENTO coluna↔texto, que é o elo que
      // faltava. Se a coluna voltar a ter string inline, este assert cai.
      expect(info).toBe(textoEsperado)
      expect(info?.toLowerCase()).toMatch(/conclu/)
    },
  )

  it('nenhum headerInfo carrega jargão de banco ou de código', () => {
    // `billableOutsidePlan` estava literalmente no tooltip de "Horas Faturáveis" — nome de
    // propriedade do HubSpot exposto ao usuário. `FechadoEm`/`InicioEm`/`Ticket.` são nomes
    // de coluna do banco: o texto tem de dizer "data de conclusão do chamado", não a coluna.
    const jargao = [/billableOutsidePlan/i, /FechadoEm/, /InicioEm/, /Ticket\./, /TimeEntry/]
    const infratores = planConsumptionColumns
      .filter((c) => c.headerInfo && jargao.some((p) => p.test(c.headerInfo!)))
      .map((c) => c.key)
    expect(infratores).toEqual([])
  })

  it('controle positivo: o detector de jargão ainda pega o texto antigo', () => {
    // Sem isto, uma regex quebrada deixaria o assert acima vacuamente verde — e o caminho
    // "natural" seria reescrever o texto para agradar ao teste em vez de corrigir o defeito.
    const antigo = 'Horas cobradas fora do plano (billableOutsidePlan).'
    expect([/billableOutsidePlan/i].some((p) => p.test(antigo))).toBe(true)
  })

  it('a varredura não passou vazia (controle positivo do próprio detector)', () => {
    expect(planConsumptionColumns.length).toBeGreaterThan(0)
    expect(planConsumptionColumns.some((c) => c.headerInfo !== undefined)).toBe(true)
  })
})
