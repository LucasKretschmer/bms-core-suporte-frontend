import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  colisoesDeChave,
  descreverColisao,
  inventarioDeQueries,
  usosDeQueryDoArquivo,
  type Sistema,
  type UsoDeQuery,
} from './queryKeyRegistry'

/**
 * 124/FE-FIX2 · `D-8` — trava contra **duas fontes na mesma entrada de cache**.
 *
 * A lista de chaves NÃO é mantida aqui: ela é derivada da AST de `src/` a cada execução
 * (`inventarioDeQueries`). O que é escrito à mão é só a **exceção nominal**, item por item,
 * com justificativa ao lado — nunca um padrão de nome.
 *
 * Os primeiros testes são o **controle positivo do detector**: um sistema de arquivos
 * fabricado onde a colisão existe de propósito. Sem eles, "0 colisões em `src/`" seria
 * indistinguível de "o detector não detecta nada".
 */

// ── Sistema de arquivos fabricado (controle do detector) ─────────────────────

function sistemaFake(arquivos: Record<string, string>): Sistema {
  return {
    ler: (caminho) => {
      const conteudo = arquivos[caminho]
      if (conteudo === undefined) throw new Error(`Arquivo inexistente: ${caminho}`)
      return conteudo
    },
    existe: (caminho) => arquivos[caminho] !== undefined,
    listar: () => Object.keys(arquivos),
  }
}

const SERVICO_A = `
export async function listarA() { return [] }
`
const SERVICO_B = `
export async function listarB() { return [] }
`

function telaCom(corpo: string): string {
  return `
import { useQuery } from '@tanstack/react-query'
import { listarA } from './servicoA'
import { listarB } from './servicoB'
export function Tela() {
  ${corpo}
}
`
}

function colisoesDe(arquivos: Record<string, string>): string[] {
  const sistema = sistemaFake({
    'src/servicoA.ts': SERVICO_A,
    'src/servicoB.ts': SERVICO_B,
    ...arquivos,
  })
  return colisoesDeChave(inventarioDeQueries('src', sistema)).map(descreverColisao)
}

describe('detector de colisão de queryKey — controle no sistema fabricado', () => {
  it('ACUSA duas queryFn distintas sob a mesma chave (o defeito D-8)', () => {
    const colisoes = colisoesDe({
      'src/tela.tsx': telaCom(`
        useQuery({ queryKey: ['planos'], queryFn: listarA })
        useQuery({ queryKey: ['planos'], queryFn: listarB })
      `),
    })

    expect(colisoes).toEqual([
      '["planos"] <- src/servicoA.ts::listarA | src/servicoB.ts::listarB',
    ])
  })

  it('NÃO acusa quando as chaves são distintas — o detector não é sempre-vermelho', () => {
    // Companheira do caso acima: mesmas duas fontes, chaves diferentes. É esta asserção
    // que prova que a de cima mede a chave, e não a mera existência de duas queries.
    expect(
      colisoesDe({
        'src/tela.tsx': telaCom(`
          useQuery({ queryKey: ['planos'], queryFn: listarA })
          useQuery({ queryKey: ['planos', 'options'], queryFn: listarB })
        `),
      }),
    ).toEqual([])
  })

  it('NÃO acusa delegação pura — `listarA` e `() => listarA()` são a MESMA fonte', () => {
    expect(
      colisoesDe({
        'src/tela.tsx': telaCom(`
          useQuery({ queryKey: ['planos'], queryFn: listarA })
          useQuery({ queryKey: ['planos'], queryFn: () => listarA() })
        `),
      }),
    ).toEqual([])
  })

  it('ACUSA quando uma das duas TRANSFORMA o resultado — é aí que nascem dois tipos', () => {
    // A forma exata da colisão pré-existente de `['teams']`: um lado devolve o DTO, o
    // outro devolve o resultado de um `.map`. Mesma chave, duas formas.
    const colisoes = colisoesDe({
      'src/tela.tsx': telaCom(`
        useQuery({ queryKey: ['planos'], queryFn: listarA })
        useQuery({
          queryKey: ['planos'],
          queryFn: async () => {
            const linhas = await listarA()
            return linhas.map((l) => ({ id: l.id }))
          },
        })
      `),
    })

    expect(colisoes).toEqual([
      '["planos"] <- src/servicoA.ts::listarA | src/tela.tsx::inline#0',
    ])
  })

  it('objeto de opções escrito com ATALHO (`{ queryKey, queryFn }`) não escapa', () => {
    // Regressão do buraco real: o detector só olhava `PropertyAssignment`, e os 5 usos de
    // `useServerTable` do repo escrevem `queryFn` em atalho — os objetos inteiros ficavam
    // fora da varredura, em silêncio.
    const sistema = sistemaFake({
      'src/servicoA.ts': SERVICO_A,
      'src/servicoB.ts': SERVICO_B,
      'src/tela.tsx': `
import { listarA } from './servicoA'
export function Tela() {
  const queryKey = ['planos']
  const queryFn = listarA
  useQuery({ queryKey, queryFn })
}
`,
    })
    const usos = usosDeQueryDoArquivo('src/tela.tsx', sistema)

    expect(usos).toHaveLength(1)
    expect(usos[0].fonte).toBe('src/tela.tsx::queryFn')
  })

  it('resolve chave declarada como constante EXPORTADA de outro módulo', () => {
    const sistema = sistemaFake({
      'src/chaves.ts': `export const CHAVE_DE_PLANOS = ['planos', 'lista'] as const`,
      'src/servicoA.ts': SERVICO_A,
      'src/tela.tsx': `
import { CHAVE_DE_PLANOS } from './chaves'
import { listarA } from './servicoA'
export function Tela() {
  useQuery({ queryKey: CHAVE_DE_PLANOS, queryFn: listarA })
}
`,
    })
    const usos = usosDeQueryDoArquivo('src/tela.tsx', sistema)

    expect(usos[0].chave).toBe('["planos","lista"]')
    expect(usos[0].resolvida).toBe(true)
  })

  it('resolve FÁBRICA de chave, com as partes dinâmicas marcadas como `?`', () => {
    const sistema = sistemaFake({
      'src/servicoA.ts': SERVICO_A,
      'src/tela.tsx': `
import { listarA } from './servicoA'
const chaveDeFeriados = (id: number, data: string) => ['calendars', id, 'holidays', data]
export function Tela() {
  useQuery({ queryKey: chaveDeFeriados(1, '2026-01-01'), queryFn: listarA })
}
`,
    })
    const usos = usosDeQueryDoArquivo('src/tela.tsx', sistema)

    expect(usos[0].chave).toBe('["calendars",?,"holidays",?]')
    expect(usos[0].resolvida).toBe(true)
  })

  it('chave que NÃO dá para resolver sai marcada — nunca desaparece do inventário', () => {
    const sistema = sistemaFake({
      'src/servicoA.ts': SERVICO_A,
      'src/tela.tsx': `
import { listarA } from './servicoA'
export function Tela(prefixo: string) {
  useQuery({ queryKey: prefixo, queryFn: listarA })
}
`,
    })
    const usos = usosDeQueryDoArquivo('src/tela.tsx', sistema)

    expect(usos).toHaveLength(1)
    expect(usos[0].resolvida).toBe(false)
    expect(usos[0].chave).toBe('prefixo')
  })
})

// ── Varredura do código real ─────────────────────────────────────────────────

function listarRecursivo(diretorio: string): string[] {
  const saida: string[] = []
  for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = `${diretorio}/${entrada.name}`
    if (entrada.isDirectory()) saida.push(...listarRecursivo(caminho))
    else saida.push(caminho)
  }
  return saida
}

const sistemaReal: Sistema = {
  ler: (caminho) => readFileSync(caminho, 'utf8'),
  existe: (caminho) => existsSync(caminho) && statSync(caminho).isFile(),
  listar: listarRecursivo,
}

/**
 * Colisões **pré-existentes**, aceitas nominalmente item por item. Não é padrão de nome,
 * não é prefixo, não é "tudo que já existia": é esta linha, com esta justificativa.
 * Qualquer colisão nova reprova este teste.
 */
const COLISOES_ACEITAS: readonly string[] = [
  // `dashboards/support/index.tsx` lê `['teams']` com uma `queryFn` que faz `.map` para
  // `{id, nome, gerencia}`, enquanto os outros 4 usos leem o `TeamDto` inteiro de
  // `reportsService.listTeams` sob a MESMA chave. É a mesma classe do D-8, PRÉ-EXISTENTE
  // e fora do escopo da unidade FE-FIX2 (mexer em `dashboards/support/index.tsx` no fim da
  // demanda 124 é criar regressão fora do radar). Registrada no `fe-fix2-report.md` como
  // candidata a demanda própria; a correção é dar chave própria à versão mapeada.
  '["teams"] <- src/features/dashboards/support/index.tsx::inline#0 | src/features/reports/shared/services/reportsService.ts::listTeams',
]

/**
 * Chaves que o detector não resolve estaticamente — todas do mesmo desenho: um wrapper
 * (`useServerTable` e irmãos) recebe o PREFIXO da chave como string e monta o array lá
 * dentro. Travadas por **identidade** (não por contagem): entrada nova aqui é decisão
 * consciente, não silêncio.
 */
const NAO_RESOLVIDAS_ACEITAS: readonly string[] = [
  // ── 132 (telas novas sob GerentePlus) ────────────────────────────────────────────────
  // Três chaves, três prefixos DISTINTOS: nenhuma delas colide com outra fonte (o teste
  // seguinte, que trata as não resolvidas como resolvidas, é quem prova isso).
  // ⚠️ A entrada de `hour-credits` é da unidade F5, que está sendo desenvolvida na mesma
  // janela; foi acrescentada AQUI, pela F7/F8, porque o invariante já estava vermelho por
  // causa dela e a árvore é compartilhada. **Não duplicar** ao integrar a F5 — a lista é
  // comparada por igualdade, e uma linha repetida reprova.
  "src/features/billing-periods/hooks/useBillingPeriodComparison.ts | BILLING_PERIOD_COMPARISON_QUERY_KEY",
  "src/features/billing-periods/hooks/useBillingPeriods.ts | BILLING_PERIODS_QUERY_KEY",
  'src/features/hour-credits/hooks/useHourCredits.ts | HOUR_CREDITS_QUERY_KEY',
  // ─────────────────────────────────────────────────────────────────────────────────────
  'src/features/client-tickets/hooks/useClientTickets.ts | `client-tickets:${clientId}`',
  "src/features/movimentacao-diaria/hooks/useMovimentacaoDiariaLogs.ts | 'movimentacao-diaria-logs'",
  "src/features/reports/appointments/hooks/useAppointments.ts | 'tickets-report'",
  "src/features/reports/client-report/hooks/useClientReport.ts | 'client-report'",
  "src/features/reports/plan-consumption/hooks/usePlanConsumption.ts | 'plan-consumption'",
  "src/features/reports/productivity/hooks/useProductivity.ts | 'productivity'",
  "src/features/reports/project-appointments/hooks/useProjectAppointments.ts | 'project-appointments-report'",
  "src/features/reports/shared/hooks/useServerTable.test.tsx | 'test'",
]

function descreverNaoResolvida(uso: UsoDeQuery): string {
  return `${uso.arquivo} | ${uso.chave}`
}

describe('inventário real de queries de src/ (derivado da AST, nunca à mão)', () => {
  const usos = inventarioDeQueries('src', sistemaReal)

  it('a varredura não é inerte: encontra dezenas de queries em src/', () => {
    // Sem este piso, um erro de caminho faria a varredura devolver `[]` e TODAS as
    // asserções de "nenhuma colisão" passariam vacuamente.
    expect(usos.length).toBeGreaterThan(40)
    expect(usos.filter((uso) => uso.resolvida).length).toBeGreaterThan(35)
  })

  it('D-8 corrigido: as duas leituras de /support-plans têm chaves DIFERENTES', () => {
    const doSupportPlans = usos.filter((uso) => uso.chave.startsWith('["support-plans"'))

    // Identidade, não cardinalidade: os três usos, com chave e fonte nominais.
    expect(doSupportPlans.map((uso) => `${uso.chave} <- ${uso.fonte}`).sort()).toEqual([
      '["support-plans","options"] <- src/features/reports/shared/services/reportsService.ts::listSupportPlans',
      '["support-plans","unmatched"] <- src/features/support-plans/services/supportPlansService.ts::listUnmatchedPlans',
      '["support-plans"] <- src/features/support-plans/services/supportPlansService.ts::listSupportPlans',
    ])
  })

  it('nenhuma colisão de queryKey além das pré-existentes aceitas nominalmente', () => {
    const encontradas = colisoesDeChave(usos).map(descreverColisao)

    expect(encontradas).toEqual([...COLISOES_ACEITAS])
  })

  it('as chaves não resolvidas são exatamente as aceitas — identidade, não contagem', () => {
    // Conjunto (não lista): trava QUAIS arquivos e QUAIS chaves ficam fora da resolução
    // estática. A repetição de um mesmo prefixo dentro de um arquivo é irrelevante aqui —
    // quem cuida disso é o teste seguinte, que compara as FONTES.
    const encontradas = [
      ...new Set(usos.filter((uso) => !uso.resolvida).map(descreverNaoResolvida)),
    ].sort()

    expect(encontradas).toEqual([...NAO_RESOLVIDAS_ACEITAS].sort())
  })

  it('nem entre as chaves NÃO resolvidas há duas fontes sob o mesmo prefixo', () => {
    // O que o detector estático não alcança nos wrappers (`useServerTable` e irmãos) é
    // coberto aqui pela mesma regra: o array real é `[prefixo, page, …]`, então prefixo
    // igual com fonte diferente é a mesma colisão. Derivado do inventário, não listado.
    const comoResolvidas = usos
      .filter((uso) => !uso.resolvida)
      .map((uso) => ({ ...uso, resolvida: true }))

    expect(colisoesDeChave(comoResolvidas).map(descreverColisao)).toEqual([])
  })
})
