import { contrastRatio, razaoEntreLuminancias, relativeLuminance } from './colorContrast'
import {
  comAlfa,
  contextoDePintura,
  opacidadeDoElemento,
  type Cenario,
  type ContextoDePintura,
  type PadroesDoBody,
  type PuloDeVarredura,
  type TemaDeTexto,
  type TokensDeCor,
} from './contrasteDeTexto'
import { focaveisDentro } from '../components/ui/focusableElements'

/**
 * **O medidor do ANEL DE FOCO — contraste NÃO-TEXTUAL (WCAG 1.4.11), piso 3:1.**
 *
 * Demanda 126, achado `Q-125-5` do QA da 125: `:focus-visible { outline: 2px solid
 * var(--color-primary) }` media **1,00–1,53:1** sobre `bg-grad-escuro`, o fundo da
 * `Sidebar`. Quem navega por teclado não via onde estava.
 *
 * ## Por que um módulo novo, e por que ele NÃO é um segundo medidor
 *
 * A demanda 125 fechou `Q-2` consolidando os **dois** medidores de contraste de texto num
 * só (`utils/contrasteDeTexto.ts`) — duas fontes de verdade sobre a mesma pergunta
 * divergem. Este arquivo **não** reabre aquilo: a pergunta é outra (indicador
 * não-textual × fundo adjacente, piso **3:1**, e não texto × fundo, piso 4,5:1), mas o
 * **modelo de pintura é o mesmo e vem importado** — `contextoDePintura` (fundo herdado da
 * cadeia de ancestrais, paradas de gradiente, grupos `opacity-*`, recusa do que não
 * modela) e `comAlfa`. Nenhuma aritmética de cor é reimplementada aqui.
 *
 * O universo de "o que recebe foco" também é importado, nunca redigitado:
 * `components/ui/focusableElements.ts::focaveisDentro`, a mesma definição que o focus trap
 * do `Modal` usa. Seletor paralelo mantido à mão são duas fontes de verdade, e a
 * divergência entre elas é silenciosa.
 *
 * ## O que "medir o anel" quer dizer
 *
 * Um anel de foco é pintado **fora** da borda do elemento. Logo a cor adjacente a ele
 * **não é o fundo do próprio elemento** — é o fundo que o **pai** pinta (ou o que estiver
 * acima na cadeia, até o `body`). Por isso a medição parte de `elemento.parentElement`. A
 * opacidade do próprio elemento entra depois, como grupo de pintura: um `opacity-50` no
 * botão apaga o anel dele junto.
 *
 * ## Duas camadas, e por que o veredito é o MÁXIMO delas
 *
 * O anel corrigido tem duas camadas de cor (clara colada no elemento, escura por fora).
 * Um indicador de duas cores é percebível quando **pelo menos uma** delas se distingue do
 * fundo — é assim que o anel padrão do Chrome funciona, e é o que torna o indicador
 * independente do fundo: **nenhuma cor única** atinge 3:1 contra `#ffffff` **e** contra
 * `#002f4f` ao mesmo tempo (a prova está em `razaoMinimaSobreQualquerFundo`). Por isso
 * `razao` é o **máximo** por camada, e não o mínimo como no texto — no texto há uma cor
 * só, e a pergunta é se ELA se lê.
 *
 * A outra metade da regra é o contraste **entre** as camadas (`razaoEntreCamadas`): é ele
 * que garante que, quando a camada de fora some no fundo, a de dentro ainda apareça como
 * uma borda desenhada, e não como um borrão.
 *
 * ## Nada vira fallback silencioso
 *
 * Mesma regra da 125: **ou modela, ou RECUSA**, e `pulados` é asserido vazio nos
 * invariantes. O que muda de forma (fundo inline, `bg-[…]`, gradiente nativo do Tailwind)
 * cai em `pulados` **com o motivo**, nunca no fundo da página.
 */

/** Piso WCAG 1.4.11 (contraste não-textual): indicador de foco, borda, ícone. */
export const PISO_NAO_TEXTUAL = 3

/** Uma camada de cor do anel, com a geometria que o CSS declara. */
export type CamadaDoAnel = {
  /** A declaração CSS que a pinta. */
  propriedade: 'box-shadow' | 'outline'
  /** Token resolvido: `--color-white`. */
  token: string
  hex: string
  /** Distância, em px, da borda do elemento até a borda INTERNA da camada. */
  inicioPx: number
  espessuraPx: number
}

/** O anel de foco declarado pelo CSS do app, derivado da regra `:focus-visible`. */
export type AnelDeFoco = {
  /** Da camada mais interna para a mais externa. */
  camadas: CamadaDoAnel[]
  /** O corpo da regra `:focus-visible`, como está no CSS (entra na mensagem de falha). */
  regra: string
}

const REGEX_COMENTARIO_CSS = /\/\*[\s\S]*?\*\//g
const REGEX_DECLARACAO = /([a-z-]+)\s*:\s*([^;]+)/gi
/** `2px solid var(--color-primary)` — largura, estilo e token, nesta ordem. */
const REGEX_OUTLINE = /^(\d+(?:\.\d+)?)px\s+solid\s+var\(\s*(--color-[a-z0-9-]+)\s*\)$/i
/** `0 0 0 2px var(--color-white)` — sombra sólida, sem deslocamento nem desfoque. */
const REGEX_BOX_SHADOW = /^0\s+0\s+0\s+(\d+(?:\.\d+)?)px\s+var\(\s*(--color-[a-z0-9-]+)\s*\)$/i
const REGEX_PX = /^(-?\d+(?:\.\d+)?)px$/

/**
 * Os corpos de **todas** as regras cujo seletor menciona `:focus-visible`, no CSS já sem
 * comentários.
 *
 * Escrito à mão, com índices, e não como uma regex de "regra inteira", porque a regex
 * óbvia (`(^|\})[^{}]*:focus-visible[^{}]*\{([^}]*)\}`) **consome o `}` da regra anterior**
 * e, com `matchAll`, não consegue casar duas regras seguidas: ela achava UMA onde havia
 * DUAS, em silêncio — a contagem que dá poder ao invariante saindo menor do que o
 * conjunto real. Foi o caso de teste `duas regras` que o pegou.
 *
 * A dedupe por posição do `{` é o que faz `a:focus-visible, b:focus-visible { … }` contar
 * como **uma** regra (lista de seletores), e não como duas.
 */
function corposDasRegrasDeFoco(css: string): string[] {
  const porBloco = new Map<number, string>()
  let ocorrencia = css.indexOf(':focus-visible')
  while (ocorrencia !== -1) {
    const abre = css.indexOf('{', ocorrencia)
    const fecha = css.indexOf('}', abre)
    if (abre !== -1 && fecha !== -1) porBloco.set(abre, css.slice(abre + 1, fecha))
    ocorrencia = css.indexOf(':focus-visible', ocorrencia + ':focus-visible'.length)
  }
  return Array.from(porBloco.values())
}

function exigirToken(tokens: TokensDeCor, token: string, onde: string): string {
  const hex = tokens[token]
  if (hex === undefined) {
    throw new Error(
      `O \`${onde}\` de \`:focus-visible\` aponta para "${token}", que não existe na ` +
        'cascata de CSS do app. Ou o token é novo e precisa ser declarado, ou o nome está ' +
        'errado — nos dois casos o anel não é mensurável.',
    )
  }
  return hex
}

/**
 * O anel de foco que o CSS do app de fato declara — **derivado da cascata real**, nunca
 * digitado num teste.
 *
 * **Lança** em tudo que não souber modelar, e é de propósito: esta função sustenta um
 * invariante, e um anel que "não deu para ler" tem de reprovar a suíte, não sumir dela. Em
 * particular lança quando existe **mais de uma** regra `:focus-visible` na cascata — com
 * duas regras o vencedor depende de camada e especificidade, e medir a primeira seria
 * responder outra pergunta (o modo de falha nº 2 do tracker da 125).
 */
export function anelDeFocoDoCss(conteudoCss: string, tokens: TokensDeCor): AnelDeFoco {
  const limpo = conteudoCss.replace(REGEX_COMENTARIO_CSS, '')
  const regras = corposDasRegrasDeFoco(limpo)
  if (regras.length !== 1) {
    throw new Error(
      `A cascata de CSS do app declara ${regras.length} regra(s) \`:focus-visible\` — o ` +
        'anel de foco só é derivável quando há exatamente uma. Com zero não há anel nenhum ' +
        '(e a varredura passaria vazia); com duas, quem vence depende de camada e ' +
        'especificidade, e medir a primeira responderia outra pergunta.',
    )
  }
  const corpo = regras[0]
  let deslocamento = 0
  let outline: { token: string; hex: string; espessuraPx: number } | null = null
  let sombra: { token: string; hex: string; espessuraPx: number } | null = null

  for (const declaracao of Array.from(corpo.matchAll(REGEX_DECLARACAO))) {
    const propriedade = declaracao[1].toLowerCase()
    const valor = declaracao[2].replace(/\s+/g, ' ').trim()

    if (propriedade === 'outline-offset') {
      const px = REGEX_PX.exec(valor)
      if (px === null) {
        throw new Error(`\`outline-offset: ${valor}\` não é um valor em px — não modelado.`)
      }
      deslocamento = Number(px[1])
      continue
    }
    if (propriedade === 'outline') {
      const m = REGEX_OUTLINE.exec(valor)
      if (m === null) {
        throw new Error(
          `\`outline: ${valor}\` não está na forma "<largura>px solid var(--color-*)". O ` +
            'medidor não deriva a cor do anel daí e RECUSA em vez de adivinhar — inclusive ' +
            'de `outline: none`, que é a ausência de anel e nunca pode passar despercebida.',
        )
      }
      outline = {
        token: m[2],
        hex: exigirToken(tokens, m[2], 'outline'),
        espessuraPx: Number(m[1]),
      }
      continue
    }
    if (propriedade === 'box-shadow') {
      const m = REGEX_BOX_SHADOW.exec(valor)
      if (m === null) {
        throw new Error(
          `\`box-shadow: ${valor}\` não está na forma "0 0 0 <spread>px var(--color-*)". ` +
            'Sombra com deslocamento ou desfoque não é um anel de espessura constante, e a ' +
            'geometria do indicador deixaria de ser derivável.',
        )
      }
      sombra = {
        token: m[2],
        hex: exigirToken(tokens, m[2], 'box-shadow'),
        espessuraPx: Number(m[1]),
      }
      continue
    }
    throw new Error(
      `Declaração \`${propriedade}: ${valor}\` na regra \`:focus-visible\` não é modelada ` +
        'por este medidor. Toda propriedade capaz de pintar (ou apagar) o anel entra no ' +
        'modelo ANTES de entrar no CSS — senão o invariante mede um anel que não é o que a ' +
        'tela desenha.',
    )
  }

  if (outline === null) {
    throw new Error(
      'A regra `:focus-visible` não declara `outline` — sem ela não há anel de foco algum, ' +
        'e uma varredura de zero camadas passa em qualquer piso.',
    )
  }

  const camadas: CamadaDoAnel[] = []
  if (sombra !== null) camadas.push({ propriedade: 'box-shadow', ...sombra, inicioPx: 0 })
  camadas.push({ propriedade: 'outline', ...outline, inicioPx: deslocamento })
  camadas.sort((a, b) => a.inicioPx - b.inicioPx)
  return { camadas, regra: corpo.replace(/\s+/g, ' ').trim() }
}

/** A espessura total do indicador, em px — a metade "percebível" do requisito. */
export function espessuraTotalPx(anel: AnelDeFoco): number {
  return anel.camadas.reduce((total, camada) => total + camada.espessuraPx, 0)
}

/**
 * As camadas do anel são contíguas (cada uma começa onde a anterior termina)?
 *
 * Vão entre camadas significa fundo do container aparecendo no meio do indicador: sobre um
 * fundo intermediário isso parte o anel em dois tracinhos, e a espessura percebida deixa
 * de ser a soma. É requisito de FORMA, não de razão de contraste — e é exatamente o que
 * o anel de antes fazia (o `outline-offset: 2px` sem nada preenchendo o vão).
 */
export function camadasSaoContiguas(anel: AnelDeFoco): boolean {
  return anel.camadas.every((camada, i) => {
    const anterior = i === 0 ? null : anel.camadas[i - 1]
    const esperado = anterior === null ? 0 : anterior.inicioPx + anterior.espessuraPx
    return camada.inicioPx === esperado
  })
}

/** O contraste entre camadas vizinhas — o que faz o anel ser visto como desenho. */
export function razaoEntreCamadas(anel: AnelDeFoco): number[] {
  return anel.camadas.slice(1).map((camada, i) => contrastRatio(anel.camadas[i].hex, camada.hex))
}

/**
 * O PIOR fundo possível para este anel, varrendo **toda** a faixa de luminância (0 a 1).
 *
 * É a prova que dispensa enumerar as superfícies do app: como `razao` é o máximo por
 * camada, existe um mínimo global sobre todos os fundos concebíveis. Se ele é ≥ 3:1, o
 * anel atende WCAG 1.4.11 sobre **qualquer** fundo — inclusive os que a app ainda não tem.
 * Uma lista de fundos mantida à mão nasceria incompleta e envelheceria
 * (`rules/security.md` § enumeração que dá poder a um invariante); aqui o universo é o
 * contradomínio inteiro da luminância relativa, que nenhuma cor sRGB pode deixar.
 */
export function razaoMinimaSobreQualquerFundo(
  anel: AnelDeFoco,
  passos = 100_000,
): { razao: number; luminancia: number } {
  const luminanciasDasCamadas = anel.camadas.map((camada) => relativeLuminance(camada.hex))
  let pior = Number.POSITIVE_INFINITY
  let onde = 0
  for (let i = 0; i <= passos; i += 1) {
    const luminancia = i / passos
    const melhorCamada = Math.max(
      ...luminanciasDasCamadas.map((l) => razaoEntreLuminancias(l, luminancia)),
    )
    if (melhorCamada < pior) {
      pior = melhorCamada
      onde = luminancia
    }
  }
  return { razao: pior, luminancia: onde }
}

/** Uma medição do anel num elemento focável real. */
export type MedidaDoAnel = {
  /** Como o elemento aparece na mensagem de falha: tag + nome acessível. */
  alvo: string
  /** Hex do fundo efetivo ATRÁS do anel (o que o pai pinta), já composto. */
  fundo: string
  /** A razão de cada camada contra esse fundo, na ordem de dentro para fora. */
  porCamada: { token: string; hex: string; razao: number }[]
  /** A razão que vale: a MELHOR camada (ver o cabeçalho do módulo). */
  razao: number
}

export type VarreduraDoAnel = {
  medidas: MedidaDoAnel[]
  pulados: PuloDeVarredura[]
}

function descrever(elemento: Element): string {
  const rotulo = (
    elemento.getAttribute('aria-label') ??
    elemento.getAttribute('title') ??
    (elemento.textContent ?? '')
  )
    .trim()
    .slice(0, 40)
  const tag = elemento.tagName.toLowerCase()
  return rotulo === '' ? `<${tag}>` : `<${tag}> "${rotulo}"`
}

/**
 * Mede o anel de foco de **todo** elemento focável da árvore renderizada, contra o fundo
 * que de fato está atrás dele.
 *
 * Fundo em gradiente vira **uma medida por parada** (o veredito é o do pior ponto, como no
 * medidor de texto). O que não for modelável vai para `pulados`, com o motivo.
 */
export function medirAnelDeFoco(
  raiz: HTMLElement,
  opcoes: { tema: TemaDeTexto; padroes: PadroesDoBody; anel: AnelDeFoco },
): VarreduraDoAnel {
  const { tema, padroes, anel } = opcoes
  const medidas: MedidaDoAnel[] = []
  const pulados: PuloDeVarredura[] = []

  for (const elemento of focaveisDentro(raiz)) {
    const alvo = descrever(elemento)
    const pai = elemento.parentElement
    // O anel é pintado FORA da borda: o fundo adjacente é o do pai, nunca o do elemento.
    const semPai: ContextoDePintura = {
      tipo: 'cenarios',
      cenarios: [{ fundoLocal: padroes.fundo, grupos: [] }],
    }
    const contexto = pai === null ? semPai : contextoDePintura(pai, tema, padroes.fundo)
    if (contexto.tipo === 'recusa') {
      pulados.push({ texto: alvo, motivo: contexto.motivo })
      continue
    }

    // A opacidade do PRÓPRIO elemento apaga o anel dele junto — entra como grupo por cima.
    const opacidadePropria = opacidadeDoElemento(
      typeof elemento.className === 'string' ? elemento.className : '',
    )
    const cenarios: Cenario[] = contexto.cenarios.map((cenario) =>
      opacidadePropria < 1
        ? {
            fundoLocal: cenario.fundoLocal,
            grupos: [
              ...cenario.grupos,
              { opacidade: opacidadePropria, fundoExterno: cenario.fundoLocal },
            ],
          }
        : cenario,
    )

    for (const { fundoLocal, grupos } of cenarios) {
      // Desempilha do grupo mais interno para o mais externo, como o medidor de texto.
      const comporGrupos = (partida: string): string => {
        let cor = partida
        for (let i = grupos.length - 1; i >= 0; i -= 1) {
          cor = comAlfa(cor, grupos[i].fundoExterno, grupos[i].opacidade)
        }
        return cor
      }
      const fundo = comporGrupos(fundoLocal)
      const porCamada = anel.camadas.map((camada) => {
        const hex = comporGrupos(camada.hex)
        return { token: camada.token, hex, razao: contrastRatio(hex, fundo) }
      })
      medidas.push({
        alvo,
        fundo,
        porCamada,
        razao: Math.max(...porCamada.map((c) => c.razao)),
      })
    }
  }

  return { medidas, pulados }
}

/** As medições abaixo do piso não-textual, já formatadas para a mensagem de falha. */
export function reprovacoesDoAnel(medidas: readonly MedidaDoAnel[]): string[] {
  return medidas
    .filter((medida) => medida.razao < PISO_NAO_TEXTUAL)
    .map(
      (medida) =>
        `${medida.alvo} sobre ${medida.fundo} = ${medida.razao.toFixed(2)}:1 ` +
        `(${medida.porCamada.map((c) => `${c.token} ${c.razao.toFixed(2)}:1`).join(' · ')})`,
    )
}

/**
 * A PIOR razão medida num alvo cujo rótulo contenha `trecho` — é assim que o teste afirma
 * **o número**, e não só "não reprovou". Lança quando o alvo não foi medido: asserção
 * sobre `undefined` é o modo silencioso de um teste destes morrer.
 */
export function razaoDoAlvo(medidas: readonly MedidaDoAnel[], trecho: string): number {
  const doAlvo = medidas.filter((medida) => medida.alvo.includes(trecho))
  if (doAlvo.length === 0) {
    throw new Error(
      `Nenhum focável medido contém "${trecho}". Medidos: ${medidas.map((m) => m.alvo).join(', ')}`,
    )
  }
  return Math.min(...doAlvo.map((medida) => medida.razao))
}

/** Os fundos efetivos medidos num alvo — provam contra que cor a razão foi calculada. */
export function fundosDoAlvo(medidas: readonly MedidaDoAnel[], trecho: string): string[] {
  return Array.from(
    new Set(medidas.filter((medida) => medida.alvo.includes(trecho)).map((medida) => medida.fundo)),
  ).sort()
}
