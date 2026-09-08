/**
 * 131/FE-PROJ — **quem** renderiza a `CompetenciaNota` e **com qual enquadramento de
 * projeto**, derivado do código-fonte.
 *
 * Por que este arquivo existe: até 08/09/2026 a nota tinha um booleano `incluiProjeto`, e a
 * MESMA frase servia às duas telas. A decisão do usuário ("projetos são contratados à parte
 * e não entram no plano de suporte") mudou a regra em **uma** delas —
 * `ReportQueryRepository.cs:777-785`, região `⟪131 PLANCONSUMO-HORASUSADAS⟫` — e deixou a
 * outra intocada (`:146-179`, `:210`). Trocar os dois valores de lugar é uma edição de uma
 * palavra, não quebra tipo nenhum, e produz uma tela afirmando a regra da outra.
 *
 * O Relatório do Cliente **não tem teste de página** (lacuna declarada em
 * `ReportPageLayout.consumidores.test.ts`), então este é o único ponto que prova o valor com
 * que ele monta a nota. Para o Consumo de Planos há, além disto, vítima de componente com
 * literal em `plan-consumption/index.test.tsx`.
 *
 * A enumeração é **derivada em runtime** da fonte real (varredura de `src/features`), nunca
 * mantida à mão: uma terceira tela que passe a renderizar a nota reprova aqui e obriga a
 * declarar o enquadramento dela (`rules/security.md` § "nenhuma enumeração que dá poder a um
 * invariante é mantida à mão").
 *
 * Comando equivalente:
 *   grep -rn "<CompetenciaNota" src --include=*.tsx | grep -v "\.test\."
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ_FEATURES = resolve(process.cwd(), 'src/features')
const FONTE_DA_NOTA = resolve(
  process.cwd(),
  'src/features/reports/shared/components/CompetenciaNota.tsx',
)

function arquivosTsx(dir: string): string[] {
  const saida: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) {
      saida.push(...arquivosTsx(caminho))
      continue
    }
    if (entrada.name.endsWith('.tsx') && !entrada.name.includes('.test.')) {
      saida.push(caminho)
    }
  }
  return saida
}

/**
 * Valores da união `NotaDeProjeto`, lidos da **declaração do tipo** — não de uma lista
 * paralela. Um valor novo no tipo entra aqui sozinho e obriga cada call site a se declarar.
 */
function valoresDaUniao(): string[] {
  const fonte = readFileSync(FONTE_DA_NOTA, 'utf8')
  const linha = /export type NotaDeProjeto =([^\n]+)/.exec(fonte)
  if (linha == null) return []
  return [...linha[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
}

type CallSite = {
  /** Caminho POSIX relativo à raiz do projeto. */
  arquivo: string
  /** Valores da união literalmente presentes no arquivo (ordenados). */
  enquadramentos: string[]
}

function callSites(uniao: string[]): CallSite[] {
  const achados: CallSite[] = []
  for (const caminho of arquivosTsx(RAIZ_FEATURES)) {
    const fonte = readFileSync(caminho, 'utf8')
    if (!fonte.includes('<CompetenciaNota')) continue
    achados.push({
      arquivo: relative(process.cwd(), caminho).replace(/\\/g, '/'),
      enquadramentos: uniao
        .filter((valor) => fonte.includes(`'${valor}'`) || fonte.includes(`"${valor}"`))
        .sort(),
    })
  }
  return achados.sort((a, b) => a.arquivo.localeCompare(b.arquivo))
}

const UNIAO = valoresDaUniao()
const CALL_SITES = callSites(UNIAO)

function enquadramentoDe(sufixo: string): string[] {
  const alvo = CALL_SITES.find((c) => c.arquivo.endsWith(sufixo))
  // Vermelho nomeando o arquivo se o call site sumir — nunca `undefined` silencioso.
  expect(alvo?.arquivo, `nenhum call site em ${sufixo}`).toBeDefined()
  return alvo?.enquadramentos ?? []
}

describe('CompetenciaNota — call sites e o enquadramento de projeto (131)', () => {
  it('a varredura não passou vazia (controle positivo do próprio detector)', () => {
    // Sem isto, um erro de caminho tornaria os asserts abaixo vacuamente satisfeitos por um
    // conjunto vazio comparado com… nada.
    expect(CALL_SITES.length).toBeGreaterThan(0)
    expect(UNIAO.length).toBeGreaterThan(0)
  })

  it('a união `NotaDeProjeto` é nominalmente esta', () => {
    // Identidade, não cardinalidade: um valor que entra e outro que sai passariam numa
    // contagem. Valor novo aqui obriga a decidir qual tela o usa.
    expect(UNIAO).toEqual(['fora-do-plano', 'no-plano-por-apontamento'])
  })

  it('são exatamente estas 2 telas que renderizam a nota (identidade)', () => {
    expect(new Set(CALL_SITES.map((c) => c.arquivo))).toEqual(
      new Set([
        'src/features/reports/client-report/index.tsx',
        'src/features/reports/plan-consumption/components/PlanConsumptionHelp.tsx',
      ]),
    )
  })

  it('🔴 Consumo de Planos usa SÓ `fora-do-plano` (a 131 mudou a regra lá)', () => {
    expect(enquadramentoDe('plan-consumption/components/PlanConsumptionHelp.tsx')).toEqual([
      'fora-do-plano',
    ])
  })

  it('🔴 Relatório do Cliente usa SÓ `no-plano-por-apontamento` (lá nada mudou)', () => {
    // Propagar a 131 para cá sem decisão do usuário mexeria em número de fatura: o balde
    // `PlanoSeg` (`ReportQueryRepository.cs:210`) continua somando projeto de propósito.
    expect(enquadramentoDe('client-report/index.tsx')).toEqual(['no-plano-por-apontamento'])
  })

  it('🔴 nenhuma das duas telas usa os DOIS enquadramentos (e as duas são distintas)', () => {
    // Discriminador da troca de lugar: com os dois valores no mesmo arquivo, ou com o mesmo
    // valor nos dois, os asserts acima já caem — este nomeia o defeito.
    const porTela = CALL_SITES.map((c) => c.enquadramentos)
    expect(porTela.every((e) => e.length === 1)).toBe(true)
    expect(new Set(porTela.map((e) => e[0])).size).toBe(CALL_SITES.length)
  })
})
