/**
 * 121/F6 — quem consome o `ReportPageLayout`, DERIVADO do código-fonte.
 *
 * Por que este arquivo existe: o relatório da FAT-5 **e** o `arquitetura.md` afirmavam
 * "compartilhado por 4 telas". São **6**. O número escrito de memória apareceu duas
 * vezes, e é justamente ele que dimensiona o risco de mexer num arquivo compartilhado —
 * `AP-PROCESSO-017` / `CLAUDE.md` ("nunca afirmar fato sobre o repositório sem
 * verificar"). Um `grep` de 3 segundos resolve; uma lista mantida à mão divergiu duas
 * vezes.
 *
 * A enumeração é derivada em runtime da fonte real (varredura de `src/features`), nunca
 * mantida à mão, e o que se trava é a **IDENTIDADE** do conjunto — não a cardinalidade:
 * cardinalidade passa quando uma tela entra e outra sai (`rules/security.md` §
 * "invariante de segurança e a enumeração que lhe dá poder"; `rules/tests.md` § "suíte
 * parametrizada por enumeração encolhe em silêncio").
 *
 * Comando equivalente, citado no relatório:
 *   grep -rn "<ReportPageLayout" src --include=*.tsx | grep -v "\.test\."
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Raiz de varredura — `process.cwd()` é a raiz do projeto sob o Vitest. */
const RAIZ_FEATURES = resolve(process.cwd(), 'src/features')

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

type Consumidor = {
  /** Caminho POSIX relativo à raiz do projeto. */
  arquivo: string
  passaBanner: boolean
  temTesteDePagina: boolean
}

function consumidores(): Consumidor[] {
  const achados: Consumidor[] = []
  for (const caminho of arquivosTsx(RAIZ_FEATURES)) {
    const fonte = readFileSync(caminho, 'utf8')
    if (!fonte.includes('<ReportPageLayout')) continue
    achados.push({
      arquivo: relative(process.cwd(), caminho).replace(/\\/g, '/'),
      passaBanner: /\bbanner=/.test(fonte),
      temTesteDePagina: existsSync(caminho.replace(/\.tsx$/, '.test.tsx')),
    })
  }
  return achados.sort((a, b) => a.arquivo.localeCompare(b.arquivo))
}

const CONSUMIDORES = consumidores()

describe('ReportPageLayout — consumidores (121/F6)', () => {
  it('são exatamente estas 6 telas (identidade, não contagem)', () => {
    expect(new Set(CONSUMIDORES.map((c) => c.arquivo))).toEqual(
      new Set([
        'src/features/movimentacao-diaria/index.tsx',
        'src/features/reports/appointments/index.tsx',
        'src/features/reports/client-report/index.tsx',
        'src/features/reports/plan-consumption/index.tsx',
        'src/features/reports/productivity/index.tsx',
        'src/features/reports/project-appointments/index.tsx',
      ]),
    )
  })

  it('as telas que passam `banner` são nominalmente estas 2 — as outras 4 seguem idênticas', () => {
    // O slot é aditivo: para quem não passa, o guard `{banner && …}` é falsy e nada é
    // renderizado. Uma tela nova que comece a passar `banner` reprova aqui e obriga a
    // declarar o impacto, em vez de aparecer sozinha em produção. Foi exatamente o que
    // aconteceu na 123/FAT-1 — este teste ficou vermelho e a entrada abaixo é a
    // declaração pedida.
    //
    // ENTRADAS, item a item, com a justificativa ao lado (allowlist NOMINAL, nunca padrão
    // de nome):
    //  · plan-consumption — o `(?)` de ajuda (127/FE-AJUDA), que hospeda a nota de
    //    competência (123/FAT-1), **e** o aviso de origem dos números (132/F4d). 🔴 132/F1
    //    (D7): ele hospedava TAMBÉM o card de exceções de faturamento (121/A2), removido.
    //    O conjunto do slot encolheu na F1 e voltou a crescer na F4d — o MOTIVO é o mesmo
    //    nas três coisas, e é ele que a entrada declara: a nota e o aviso têm de sobreviver
    //    ao estado vazio da listagem, porque a listagem volta zerada justamente quando não
    //    houve apontamento no período, que é o momento em que a explicação de como o
    //    período é contado — e de qual competência gerou o número — é necessária. Em
    //    `children`, o `ReportPageLayout` só renderiza no estado "com dados" e as duas
    //    desapareceriam ali. Travado por `plan-consumption/index.test.tsx` ("o aviso
    //    sobrevive à listagem VAZIA");
    //  · client-report    — nota de competência (123/FAT-1, lacunas G5/G9). É a outra
    //    tela de FATURA e não dizia por qual data apurava. Mesmo motivo do slot: o
    //    EmptyState "nenhum apontamento no período" é o caso em que o usuário mais
    //    precisa da explicação.
    //    🔴 132/F1 — esta justificativa dizia "recorta por `Ticket.FechadoEm`
    //    (`ReportQueryRepository.cs:114-118`)", e as DUAS metades ficaram falsas: a 132/D1
    //    trocou o recorte para `TimeEntry.InicioEm` (marcador `⟪121/A1 RAMO-TICKET
    //    INICIO⟫`, medido em 09/09/2026, onde está escrito que `Ticket.FechadoEm` não
    //    participa de decisão de fatura nenhuma) e o intervalo `:114-118` já apontava
    //    para o `baseQuery` de `Status`/`DesativadoEm`, não para predicado de data.
    //    Ancorado por MARCADOR e não por linha: há trabalho de backend em voo, e número
    //    de linha envelhece entre a leitura e o merge. O texto da nota em si é da 132/F3.
    expect(new Set(CONSUMIDORES.filter((c) => c.passaBanner).map((c) => c.arquivo))).toEqual(
      new Set([
        'src/features/reports/client-report/index.tsx',
        'src/features/reports/plan-consumption/index.tsx',
      ]),
    )
  })

  /**
   * ⚠️ TRAVA DE LACUNA CONHECIDA, não requisito. Estas 4 telas não têm teste de página:
   * para elas a identidade visual pós-`banner` está provada apenas ESTRUTURALMENTE
   * (`git diff` sem linhas removidas + guard falsy), e o QA registrou isso.
   *
   * Quem escrever o teste de página de qualquer uma delas **remove a entrada desta lista
   * no mesmo commit** — o teste vermelho é o lembrete (`rules/tests.md` § "teste que
   * trava ausência temporária nomeia a condição que o remove"). A lista nunca cresce:
   * tela nova nasce com teste de página.
   */
  it('as 4 telas SEM teste de página são nominalmente estas (lacuna registrada, não coberta)', () => {
    expect(
      new Set(CONSUMIDORES.filter((c) => !c.temTesteDePagina).map((c) => c.arquivo)),
    ).toEqual(
      new Set([
        'src/features/movimentacao-diaria/index.tsx',
        'src/features/reports/client-report/index.tsx',
        'src/features/reports/productivity/index.tsx',
        'src/features/reports/project-appointments/index.tsx',
      ]),
    )
  })

  it('a varredura não passou vazia (controle positivo do próprio detector)', () => {
    // Sem isto, um erro de caminho tornaria os asserts acima vacuamente satisfeitos por
    // um conjunto vazio comparado com… nada. Aqui o vazio reprova.
    expect(CONSUMIDORES.length).toBeGreaterThan(0)
    expect(CONSUMIDORES.some((c) => c.passaBanner)).toBe(true)
    expect(CONSUMIDORES.some((c) => c.temTesteDePagina)).toBe(true)
  })
})
