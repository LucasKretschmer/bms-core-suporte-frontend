/**
 * Testes de FirstResponseVsSlaChart (#5).
 * Cobre os estados condicionais: loading, empty honesto (ambos null e parcial),
 * e render com dados válidos. Lógica de branch suficiente para justificar teste.
 *
 * ## 124/FE-TXT — por que os `/service hub/i` sumiram daqui
 *
 * Estes testes travavam o empty pelo texto ANTIGO (`/service hub/i`), que virou FALSO
 * quando `BE-F4F5` trocou a fonte do SLA (colunas do HubSpot → cálculo local sobre plano
 * + calendário; `AUTO-124-12`). Eles NÃO foram apagados: foram REESCRITOS afirmando a
 * correção, e ficaram mais específicos — a asserção passou de "contém 'service hub'"
 * (frouxa, casaria qualquer frase que citasse o portal) para o LITERAL da frase nova
 * escrito à mão, mais uma asserção de que o texto antigo NÃO voltou.
 *
 * `rules/tests.md` § "teste escrito para documentar um bug é reescrito afirmando a
 * correção, nunca apagado".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { FirstResponseVsSlaChart } from './FirstResponseVsSlaChart'
import { contrastRatio } from '../../../../utils/colorContrast'
// Cruzamento shared → support APENAS em teste (ver o describe do fim do arquivo).
import {
  PRE_CONDICAO_DO_CALCULO_DO_SLA,
  detalheSlaNaoConfigurado,
} from '../../support/components/supportSlaStates'

// Mock de getChartTokens para evitar dependência de CSS vars no jsdom.
vi.mock('../utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-verde': '#16A34A',
    'chart-amarelo': '#D97706',
    'chart-vermelho': '#DC2626',
  }),
  getChartPalette: () => ['#2563EB', '#16A34A', '#D97706'],
  resetChartTokensCache: () => {},
}))

/**
 * O texto esperado, LITERAL e escrito à mão — nunca importado do componente (importá-lo
 * faria `expect(render) .toBe(constante)` passar para qualquer valor da constante, que é
 * a tautologia do `rules/tests.md` § expectativa derivada).
 */
const MENSAGEM_ESPERADA =
  'SLA de 1ª resposta sem apuração para o período. ' +
  'O cálculo exige um calendário com expediente cadastrado e uma meta de 1ª resposta — ' +
  'do plano do cliente ou, na falta dela, a meta padrão do calendário.'

/** A frase que MORREU com `BE-F4F5`. Se ela voltar, os testes abaixo reprovam. */
const FONTE_ABANDONADA = /service hub/i

describe('FirstResponseVsSlaChart', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ambos null → empty com a frase da fonte ATUAL (plano + calendário), literal', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />)
    expect(screen.getByText(MENSAGEM_ESPERADA)).toBeInTheDocument()
  })

  it('estado parcial (um lado null) → empty honesto, sem fingir zero respostas', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={12} respondidosForaDoPrazo={null} />)
    expect(screen.getByText(MENSAGEM_ESPERADA)).toBeInTheDocument()
    // Não deve renderizar o valor parcial como se fosse gráfico válido.
    expect(screen.queryByText('Respondidos no prazo')).not.toBeInTheDocument()
  })

  it('estado parcial inverso (no prazo null) → empty honesto', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={5} />)
    expect(screen.getByText(MENSAGEM_ESPERADA)).toBeInTheDocument()
  })

  it('ambos número → renderiza o gráfico sem crash (não empty)', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={40} respondidosForaDoPrazo={8} />)
    expect(screen.queryByText(MENSAGEM_ESPERADA)).not.toBeInTheDocument()
  })

  it('ambos zero → renderiza o gráfico (zero é dado válido, não empty)', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={0} respondidosForaDoPrazo={0} />)
    expect(screen.queryByText(MENSAGEM_ESPERADA)).not.toBeInTheDocument()
  })

  it('isLoading=true → renderiza skeleton, não o gráfico nem o empty', () => {
    render(
      <FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} isLoading />,
    )
    const skeleton = document.querySelector('[aria-busy="true"]')
    expect(skeleton).toBeTruthy()
    expect(screen.queryByText(MENSAGEM_ESPERADA)).not.toBeInTheDocument()
  })
})

/**
 * 124/FE-TXT — a trava do texto.
 *
 * Asserção negativa NUNCA sozinha: "não menciona o Service Hub" é satisfeita pelo vazio
 * (empty que não renderizou, componente que quebrou, texto vazio). Toda negativa abaixo
 * vem colada à companheira POSITIVA na MESMA execução — a frase nova, por inteiro.
 */
describe('FirstResponseVsSlaChart — o empty não manda mais ao Service Hub (124/FE-TXT)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('o empty NÃO cita o Service Hub — e a frase nova está lá, na mesma execução', () => {
    const { container } = render(
      <FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />,
    )

    // POSITIVA (o discriminador que prova que o ponto observado foi alcançado).
    expect(screen.getByText(MENSAGEM_ESPERADA)).toBeInTheDocument()
    // NEGATIVA — só vale por causa da linha acima.
    expect(container.textContent).not.toMatch(FONTE_ABANDONADA)
    expect(screen.queryByText(FONTE_ABANDONADA)).not.toBeInTheDocument()
  })

  it('a frase nomeia as DUAS pré-condições do cálculo local: meta e expediente', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />)

    const texto = screen.getByText(MENSAGEM_ESPERADA).textContent ?? ''
    expect(texto).toMatch(/meta de 1ª resposta/)
    expect(texto).toMatch(/plano do cliente/)
    expect(texto).toMatch(/calendário com expediente cadastrado/)
  })

  it('a meta é apresentada com as DUAS moradas e a precedência entre elas', () => {
    // `MetricsService.cs:691` → `fonte.PlanoSlaMinutos ?? metaDoCalendario`. Dizer só
    // "no plano" mandaria preencher plano a plano quem já tem o padrão do calendário.
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />)

    const texto = screen.getByText(MENSAGEM_ESPERADA).textContent ?? ''
    expect(texto).toMatch(/do plano do cliente/)
    expect(texto).toMatch(/a meta padrão do calendário/)
    expect(texto).toMatch(/na falta dela/)
    expect(texto).not.toMatch(/exige a meta de 1ª resposta no plano do cliente/)
  })

  it('a frase NÃO elege causa: sem o discriminador, não afirma "não configurado" nem "sem chamado"', () => {
    // Este componente não recebe `ticketsAbertos` — quem discrimina é a SupportSlaSection
    // (124/FE-F4). Afirmar uma das duas causas aqui seria inventar o que não se sabe.
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />)

    const texto = screen.getByText(MENSAGEM_ESPERADA).textContent ?? ''
    expect(texto).toMatch(/sem apuração para o período/)
    expect(texto).not.toMatch(/não configurado/i)
    expect(texto).not.toMatch(/nenhum chamado/i)
  })

  it('a frase não cita propriedade interna do HubSpot nem o portal', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />)

    const texto = screen.getByText(MENSAGEM_ESPERADA).textContent ?? ''
    expect(texto).not.toMatch(/hs_/i)
    expect(texto).not.toMatch(/hubspot/i)
    expect(texto).not.toMatch(FONTE_ABANDONADA)
  })
})

/**
 * 124/FE-TXT — contraste MEDIDO da classe com que o componente compartilhado renderiza a
 * frase, não da que este arquivo passou.
 *
 * O `EmptyState` do design system ignora o `className` do wrapper para o parágrafo da
 * mensagem: ele o renderiza com `text-xs italic text-primary/30`. É o achado da §7 do
 * `fe-f4-report.md` (1,84:1 — menos da metade do piso AA), aqui CONFIRMADO por medição
 * sobre o DOM real, e travado com controle positivo do medidor.
 *
 * Quando o design system corrigir `text-primary/30`, este teste reprova — e é o sinal de
 * que a mensagem passou a ser legível onde ela mais importa.
 */
describe('FirstResponseVsSlaChart — contraste do empty compartilhado (medido no DOM)', () => {
  const PISO_AA = 4.5
  const CSS_APP = 'src/styles/global.css'
  const CSS_DS = 'node_modules/@migrate/design-system/styles.css'

  function tokenDoCss(caminho: string, token: string): string {
    const css = readFileSync(caminho, 'utf8')
    const casamento = new RegExp(token + ':[^#]{0,20}(#[0-9a-fA-F]{6})').exec(css)
    if (casamento === null) throw new Error(`Token ${token} não encontrado em ${caminho}`)
    return casamento[1]
  }

  /** Composição de cor com alfa sobre fundo opaco — o que a sintaxe `/30` faz. */
  function comAlfa(fg: string, bg: string, alfa: number): string {
    const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const [r1, g1, b1] = canais(fg)
    const [r2, g2, b2] = canais(bg)
    const mistura = [
      [r1, r2],
      [g1, g2],
      [b1, b2],
    ].map(([a, b]) => Math.round(a * alfa + b * (1 - alfa)))
    return `#${mistura.map((c) => c.toString(16).padStart(2, '0')).join('')}`
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a classe REAL do parágrafo é a do DS (`text-primary/30`), não a passada pelo wrapper', () => {
    render(
      <FirstResponseVsSlaChart
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        className="text-foreground"
      />,
    )

    const paragrafo = screen.getByText(MENSAGEM_ESPERADA)
    // Lida do DOM: é o que o usuário vê, não o que este teste pediu.
    expect(paragrafo.className).toContain('text-primary/30')
    expect(paragrafo.className).not.toContain('text-foreground')
  })

  it('e essa classe REPROVA AA — achado aberto do DS, não regressão desta unidade', () => {
    const primary = tokenDoCss(CSS_DS, '--color-primary')
    const card = tokenDoCss(CSS_APP, '--color-card')
    const razao = contrastRatio(comAlfa(primary, card, 0.3), card)

    expect(razao).toBeLessThan(PISO_AA)
    expect(razao).toBeLessThan(2)
    // Controle positivo do medidor: se ele morresse (aprovando tudo), esta linha cairia.
    expect(contrastRatio(primary, card)).toBeGreaterThanOrEqual(PISO_AA)
  })
})

/**
 * 124/FE-TXT — **um fato, um texto**: a cláusula da pré-condição do cálculo é a MESMA,
 * palavra por palavra, nas duas telas que a exibem.
 *
 * A cópia existe por uma razão estrutural (`dashboards/shared/**` não pode importar de
 * `dashboards/support/**` sem inverter a direção da dependência), mas **não é mantida no
 * olho**: este teste compara as **duas fontes reais** — o DOM que o gráfico renderiza e a
 * constante que a seção de SLA usa. Se qualquer uma das duas mudar sozinha, ele reprova.
 *
 * O cruzamento `shared → support` existe **só aqui, em teste** — nenhum arquivo de
 * produção de `shared/` importa de `support/`.
 */
describe('FirstResponseVsSlaChart — a pré-condição é UMA frase nas duas telas (124/FE-TXT)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Literal escrito à mão — a terceira fonte, independente das duas de produção. */
  const CLAUSULA_ESPERADA =
    'O cálculo exige um calendário com expediente cadastrado e uma meta de 1ª resposta — ' +
    'do plano do cliente ou, na falta dela, a meta padrão do calendário.'

  it('o texto do gráfico contém EXATAMENTE a cláusula que a seção de SLA usa', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />)
    const doGrafico = screen.getByText(MENSAGEM_ESPERADA).textContent ?? ''

    // (a) contra o literal escrito à mão — pega as duas fontes derivando juntas.
    expect(PRE_CONDICAO_DO_CALCULO_DO_SLA).toBe(CLAUSULA_ESPERADA)
    expect(doGrafico).toContain(CLAUSULA_ESPERADA)
    // (b) e uma contra a outra — pega a divergência entre elas.
    expect(doGrafico).toContain(PRE_CONDICAO_DO_CALCULO_DO_SLA)
  })

  it('a seção de SLA e o gráfico dizem a mesma coisa sobre a meta — sem segundo vocabulário', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />)
    const doGrafico = screen.getByText(MENSAGEM_ESPERADA).textContent ?? ''
    const daSecao = detalheSlaNaoConfigurado(12)

    // Cardinalidade ASSIMÉTRICA de propósito: o detalhe da seção tem prefixo (a contagem)
    // e sufixo (isento / sem primeiro atendimento) que o gráfico não tem. O que precisa
    // coincidir é a cláusula do meio — e ela coincide inteira, nos dois.
    for (const texto of [doGrafico, daSecao]) {
      expect(texto).toContain(CLAUSULA_ESPERADA)
    }
    // Discriminador: os dois textos NÃO são iguais entre si — se fossem, a asserção acima
    // estaria comparando a mesma string consigo mesma e não provaria nada.
    expect(doGrafico).not.toBe(daSecao)
    expect(daSecao).toContain('Nenhum dos 12 chamados')
    expect(doGrafico).not.toContain('Nenhum dos 12 chamados')
  })
})
