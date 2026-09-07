import { contrastRatio } from './colorContrast'

/**
 * **O medidor de contraste do repositório — um só.**
 *
 * Consolidação feita em 125/FE-A11Y-4 (`Q-2`). Até aqui existiam DOIS medidores para a
 * mesma pergunta: `features/support-plans/utils/contrasteDeTexto.ts` (124/FE-FIX2) e
 * `utils/contrasteHerdadoDoDom.ts` (125/FE-A11Y-2), que importava do primeiro e
 * reimplementava parte dele. Duas fontes de verdade sobre a mesma pergunta divergem — a
 * única questão é quando. Este arquivo é a união das duas, sem perda de capacidade: cada
 * caso que só o medidor de 124 cobria virou teste em `contrasteDeTexto.test.ts`.
 *
 * ## 1. Mede o que o elemento RENDERIZA, não o que o componente pretendia
 *
 * O `EmptyState` **do design system** põe a mensagem num `<p>` **interno** com
 * `text-xs italic text-primary/30`. O `className` passado ao wrapper vai para o `<div>` de
 * fora e **não alcança** esse `<p>`. Quem revisa lendo o JSX vê uma classe; o usuário lê
 * outra — foi assim que 1,84:1 passou por três unidades da demanda 124. Por isso a medição
 * parte da **árvore renderizada**: a classe vem do DOM e o hex vem do CSS real
 * (`utils/cssCascade.ts`).
 *
 * ## 2. As quatro formas de compor cor que as telas usam
 *
 * 1. **Herança de cor.** `Breadcrumb` põe `text-foreground/NN` no `<nav>`; quem tem o texto
 *    são os filhos, **sem classe de cor**. A cor sobe a cadeia de ancestrais, como o
 *    navegador faz, e quando ninguém declara cor vale a cor do `body`.
 * 2. **Fundo com opacidade** (`bg-border/50`): compõe sobre o que está atrás.
 * 3. **Grupo `opacity-NN`**: o navegador pinta fundo + texto e compõe **o conjunto** sobre
 *    a página. A opacidade da classe se soma à do grupo — `text-foreground/70` dentro de um
 *    `opacity-70` mede 3,00:1, não 5,47:1.
 * 4. **Fundo em GRADIENTE** (`bg-grad-escuro`, 125/FE-A11Y-4): o fundo **varia ao longo do
 *    elemento**, então não existe "o" contraste — existe um por parada de cor. O medidor
 *    devolve **uma medida por parada**, e o veredito de qualquer asserção passa a ser o do
 *    **pior ponto** (`razaoDoTexto` e `razaoDaClasse` usam o mínimo; `reprovacoesAA` pega
 *    qualquer parada abaixo do piso). Medir só a ponta escura da sidebar devolveria "passa"
 *    para um texto que reprova em metade da barra.
 *
 * ## 3. NADA vira fallback silencioso (o defeito que 125/FE-A11Y-4 corrigiu)
 *
 * A armadilha 3 do PRD 125 — *"medidor que descarta em silêncio devolve 0 reprovações"* —
 * tem uma face pior, achada pela 125/FE-A11Y-3: o medidor que **não descarta**, cai no
 * fallback e **responde outra pergunta com confiança**. Diante de um `style="background…"`
 * inline, a versão anterior media o texto contra o fundo da **página**. O número saía,
 * parecia bom, e não era o da tela.
 *
 * A regra agora é: **ou o medidor modela, ou ele RECUSA.** O que ele não sabe modelar põe o
 * texto em `pulados`, com o motivo — e `pulados` é asserido vazio em todos os invariantes,
 * de modo que a recusa **reprova** em vez de passar.
 *
 * ### A recusa tem DUAS pontas (125/FE-A11Y-5)
 *
 * Até a `FE-A11Y-4` a regra valia só para o **fundo** — o denominador da razão. O QA da 125
 * mostrou, com mutação, que o **numerador** (a cor do texto) e a **opacidade** continuavam
 * caindo no fallback silencioso: `style={{opacity: 0.15}}` na mensagem do `EmptyState`
 * deixou a suíte inteira verde (`216 passed`) com a frase a ~1,6:1 na tela, e o badge
 * "Ticket" voltando ao laranja reprovado escrito como `text-[#e07600]` manteve verde o
 * invariante *"nenhum texto abaixo de 4,5:1"*. Toda recusa nova de fundo precisa do caso
 * espelhado na outra ponta da razão — é o que esta tabela passou a enumerar:
 *
 * | Caso | Ponta | Por que não é modelável |
 * |---|---|---|
 * | `style="background…"` inline | fundo | o valor não está no CSS da cascata (pode ser `var()`, `rgb()`, valor vindo de dado) |
 * | `bg-[…]` / `bg-<x>-[…]` (valor arbitrário do Tailwind) | fundo | idem — o valor é do call site, não do tema |
 * | gradiente com parada não-hexadecimal (`rgba()`, `var()`, `url()`) | fundo | a parada tem alfa/indireção própria; compor exigiria modelar a pilha inteira |
 * | `bg-linear-to-r`, `bg-gradient-to-r`, `bg-radial`, `bg-conic` | fundo | classes **legítimas** do Tailwind cujas paradas vivem em `from-*`/`via-*`/`to-*`; recusa, **nunca lança** (lançar tira a tela inteira da varredura — foi o que manteve a `Sidebar` sem medição por quatro unidades) |
 * | `style="color…"` inline | texto | o valor vem do call site (`style={tone}` do badge de Status) |
 * | `text-[…]` que não seja tamanho (`text-[#hex]`, `text-[var(--x)]`) | texto | a cor é do call site; `text-[16px]` é **tamanho** e continua sendo ignorado |
 * | `text-<token>/[0.3]` (opacidade em notação arbitrária) | texto | a regex de `/NN` não a casa, e sem ela a classe sumia inteira |
 * | `style="opacity: …"` inline | grupo | opacidade inline é um **grupo** de pintura, igual a `opacity-NN`, e o valor é do call site |
 *
 * `bg-<nome>` que não casa com **nenhuma** dessas formas e não tem `--color-<nome>` continua
 * **lançando** — é classe errada ou token faltando, e nunca deve passar.
 *
 * ## 4. `text-*` é namespace COMPARTILHADO no Tailwind v4
 *
 * `--text-card: 16px` (tamanho) e `--color-card: #ffffff` (cor) coexistem. Classe `text-x`
 * só é cor quando `--color-x` existe **e `--text-x` não existe**. Sem essa desambiguação, o
 * `<h2 class="text-card">` do `Modal` era medido como "branco sobre branco = 1,00:1" —
 * falso positivo que empurraria o próximo a afrouxar a trava. Quem decide é o CSS do app
 * nos DOIS namespaces; nenhuma lista de utilitários é escrita à mão.
 *
 * ## 5. O que entra na varredura
 *
 * - Só elementos com **texto próprio**: contraste de texto se mede onde há texto.
 * - Nada sob `aria-hidden="true"`: é conteúdo **declarado decorativo** pelo próprio
 *   componente. O critério é **semântico**, lido do DOM — nunca "parece decorativo"
 *   (`AP-FRONTEND-027`).
 * - Variantes (`dark:`, `hover:`) ficam de fora — afirmar sobre o tema escuro sem medir
 *   seria pior do que não afirmar.
 *
 * Módulo **puro**: hexes e tema entram por parâmetro. Quem lê o CSS do disco é o harness de
 * teste (`src/test/medidor-de-contraste.ts`), que não contém lógica de medição nenhuma.
 */

// ═══════════════════════════════════════════════════════════════════════════════════════
// Tema — os dois namespaces de `text-*` e os fundos em imagem, todos derivados da cascata
// ═══════════════════════════════════════════════════════════════════════════════════════

/** `--color-foreground` -> `#002f4f`. Vem de `utils/cssCascade.ts::lerTokensDeCor`. */
export type TokensDeCor = Readonly<Record<string, string>>

/** O tema derivado da cascata real de CSS. Nenhuma das três partes é digitada à mão. */
export type TemaDeTexto = {
  cores: TokensDeCor
  /** Nomes com `--text-<nome>` declarado (tamanho de fonte): `card`, `body`, `aux`… */
  tamanhosDeTexto: ReadonlySet<string>
  /**
   * Utilitários de `background-image` do design system, com o valor já resolvido:
   * `bg-grad-escuro` -> `linear-gradient(99deg, #074b7f 2.24%, #002f4f 93.71%)`.
   * Derivado dos blocos `@utility` da cascata — a lista NUNCA é mantida à mão, senão um
   * gradiente novo nasceria fora da varredura, em silêncio.
   */
  fundosDeImagem: Readonly<Record<string, string>>
}

const REGEX_TAMANHO_DE_TEXTO = /--text-([a-z0-9-]+)\s*:/g
const REGEX_COMENTARIO_CSS = /\/\*[\s\S]*?\*\//g

/**
 * `@utility bg-x { background-image: var(--y) }` — a fonte real do mapeamento entre a
 * classe e o token de imagem. Comentários são removidos antes: um exemplo dentro de bloco
 * de comentário não é uma declaração (`rules/security.md` § invariante na AST, nunca em
 * substring).
 */
const REGEX_UTILITY_DE_IMAGEM =
  /@utility\s+(bg-[a-z0-9-]+)\s*\{[^}]*?background-image\s*:\s*var\(\s*(--[a-z0-9-]+)\s*\)[^}]*?\}/g
const REGEX_CUSTOM_PROPERTY = /(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g

/** Os nomes do namespace `--text-*` (tamanho de fonte) declarados num CSS. */
export function nomesDeTamanhoDeTexto(conteudoCss: string): string[] {
  return Array.from(conteudoCss.matchAll(REGEX_TAMANHO_DE_TEXTO)).map((m) => m[1])
}

/**
 * Os utilitários de `background-image` declarados num CSS: `bg-grad-escuro` -> `--grad-escuro`.
 * O valor da custom property **não** é resolvido aqui de propósito — no design system o
 * `@utility` mora em `styles.css` e o `--grad-*` em `tokens.css`. Resolver por arquivo daria
 * `var(--grad-escuro)` cru e o gradiente inteiro cairia na recusa, em silêncio.
 */
export function utilitariosDeImagemDoCss(conteudoCss: string): Record<string, string> {
  const limpo = conteudoCss.replace(REGEX_COMENTARIO_CSS, '')
  const achados: Record<string, string> = {}
  for (const m of limpo.matchAll(REGEX_UTILITY_DE_IMAGEM)) achados[m[1]] = m[2]
  return achados
}

/** As custom properties declaradas num CSS, com o valor normalizado numa linha. */
export function customPropertiesDoCss(conteudoCss: string): Record<string, string> {
  const limpo = conteudoCss.replace(REGEX_COMENTARIO_CSS, '')
  const achados: Record<string, string> = {}
  for (const m of limpo.matchAll(REGEX_CUSTOM_PROPERTY)) {
    achados[m[1]] = m[2].replace(/\s+/g, ' ').trim()
  }
  return achados
}

/**
 * O tema montado a partir da cascata real de CSS — as três partes derivadas, nenhuma
 * digitada. `cascata` vem de `cssCascade.derivarCascataDeCssDoApp`.
 *
 * A resolução dos gradientes é feita **ao final**, sobre a cascata inteira: a declaração do
 * utilitário e a da custom property vivem em arquivos diferentes. Utilitário cujo token não
 * exista em lugar nenhum fica com o `var(...)` cru — e aí o parser de gradiente RECUSA, que
 * é o comportamento certo: quem some é a medição, nunca o aviso.
 */
export function temaDaCascata(
  cascata: readonly string[],
  ler: (caminho: string) => string,
  cores: TokensDeCor,
): TemaDeTexto {
  const tamanhos = new Set<string>()
  const utilitarios: Record<string, string> = {}
  const propriedades: Record<string, string> = {}
  for (const arquivo of cascata) {
    const conteudo = ler(arquivo)
    for (const nome of nomesDeTamanhoDeTexto(conteudo)) tamanhos.add(nome)
    Object.assign(utilitarios, utilitariosDeImagemDoCss(conteudo))
    Object.assign(propriedades, customPropertiesDoCss(conteudo))
  }
  if (tamanhos.size === 0) {
    throw new Error(
      'Nenhum token `--text-*` encontrado na cascata — sem eles a desambiguação entre ' +
        'cor e tamanho de fonte fica inerte, e `text-card` volta a ser medido como cor.',
    )
  }
  const fundosDeImagem: Record<string, string> = {}
  for (const [classe, token] of Object.entries(utilitarios)) {
    fundosDeImagem[classe] = propriedades[token] ?? `var(${token})`
  }
  return { cores, tamanhosDeTexto: tamanhos, fundosDeImagem }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Aritmética de cor
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Piso WCAG AA para texto normal. */
export const PISO_AA = 4.5

function hexParaCanais(hex: string): [number, number, number] {
  const cru = hex.replace('#', '')
  if (cru.length !== 6 || /[^0-9a-fA-F]/.test(cru)) throw new Error(`Hex inválido: "${hex}"`)
  const valor = Number.parseInt(cru, 16)
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255]
}

function canaisParaHex(canais: readonly number[]): string {
  return `#${canais.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Composição de uma cor com opacidade sobre um fundo opaco — o que `/70` de fato produz na
 * tela. Sem isto a medição usaria a cor cheia e aprovaria tudo.
 */
export function comAlfa(corHex: string, fundoHex: string, alfa: number): string {
  const frente = hexParaCanais(corHex)
  const fundo = hexParaCanais(fundoHex)
  return canaisParaHex(frente.map((canal, i) => canal * alfa + fundo[i] * (1 - alfa)))
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Cor de texto declarada em classe
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Uma cor de texto encontrada no DOM. */
export type CorDeTexto = {
  /** A classe crua, como está no elemento: `text-foreground/70`. */
  classe: string
  /** Token resolvido: `--color-foreground`. */
  token: string
  /** Opacidade em 0–1 (1 quando a classe não traz `/NN`). */
  alfa: number
}

const REGEX_CLASSE_DE_TEXTO = /(?:^|\s)(text-([a-z0-9-]+)(?:\/(\d{1,3}))?)(?=\s|$)/g

/**
 * `text-[…]` com modificador opcional (`text-[16px]/[1.5]`). O grupo 2 é o valor de dentro
 * dos colchetes — é ele que decide se a classe é **tamanho** (ignorável) ou **cor**.
 */
const REGEX_TEXTO_ARBITRARIO = /(?:^|\s)(text-\[([^\]]*)\](?:\/(?:\[[^\]]*\]|[\w.-]+))?)(?=\s|$)/g

/** `text-<token>/[0.3]` — opacidade em notação arbitrária, que `REGEX_CLASSE_DE_TEXTO` não casa. */
const REGEX_OPACIDADE_ARBITRARIA = /(?:^|\s)(text-([a-z0-9-]+)\/\[[^\]]*\])(?=\s|$)/g

/**
 * Os valores arbitrários de `text-[…]` que são **tamanho de fonte**, não cor. É a única
 * forma que o medidor pode ignorar em silêncio, e por isso ela é enumerada por **tipo de
 * dado** (comprimento, função de cálculo ou o hint explícito `length:`), nunca por lista de
 * ocorrências: hoje há 33 `text-[NNpx]` nesta árvore e nenhum `text-[#hex]`, o que torna
 * `text-[…]` idiomático aqui — e o escorregão mais provável.
 */
const REGEX_TAMANHO_ARBITRARIO =
  /^(length:.+|-?\d*\.?\d+(px|r?em|%|vw|vh|vmin|vmax|pt|pc|cm|mm|in|ch|ex|q)|(calc|clamp|min|max)\(.*\))$/i

/**
 * A cor de texto que o medidor **não sabe modelar**, ou `null` quando não há nenhuma.
 *
 * Simétrica de `declaracaoInlineNaoModelavel` (fundo/cor no atributo `style`) e de
 * `REGEX_FUNDO_ARBITRARIO` (fundo em valor arbitrário): sem ela, `text-[#b3c1ca]` e
 * `text-foreground/[0.3]` simplesmente **não casavam nenhuma regex** e o elemento caía na
 * cor herdada — o medidor respondia, com confiança, o contraste de **outro** elemento
 * (13,82:1 onde a tela mostra 1,84:1).
 *
 * Precisão, nunca frouxidão: `text-[16px]` é **tamanho** e continua ignorado, como
 * `text-sm`. Quem separa os dois é o **tipo do valor**, não uma lista de call sites.
 */
export function classeDeTextoNaoModelavel(className: string, tema: TemaDeTexto): string | null {
  for (const casamento of className.matchAll(REGEX_TEXTO_ARBITRARIO)) {
    const [, classe, valor] = casamento
    if (REGEX_TAMANHO_ARBITRARIO.test(valor.trim())) continue
    return (
      `classe de texto com valor arbitrário "${classe}" — a cor é do call site, não do ` +
      'tema, e o medidor RECUSA em vez de cair na cor herdada (que mediria o contraste de ' +
      'outro elemento e aprovaria).'
    )
  }
  for (const casamento of className.matchAll(REGEX_OPACIDADE_ARBITRARIA)) {
    const [, classe, nome] = casamento
    // `text-card/[1.5]` é altura de linha sobre um token de TAMANHO — não é opacidade.
    if (tema.tamanhosDeTexto.has(nome)) continue
    return (
      `classe de texto "${classe}" traz a opacidade em notação arbitrária — a regex de ` +
      '`/NN` não a casa, e sem esta recusa a classe inteira sumiria da varredura em ' +
      'silêncio, deixando o texto ser medido com a cor herdada.'
    )
  }
  return null
}

/** As cores de texto declaradas numa lista de classes (ver §4 do cabeçalho). */
export function coresDeTextoDaClasse(className: string, tema: TemaDeTexto): CorDeTexto[] {
  const achadas: CorDeTexto[] = []
  for (const casamento of className.matchAll(REGEX_CLASSE_DE_TEXTO)) {
    const [, classe, nome, opacidade] = casamento
    // Namespace de TAMANHO de fonte vence: `text-card` é 16px, não a cor do card. O
    // modificador `/N` ali é altura de linha, não opacidade.
    if (tema.tamanhosDeTexto.has(nome)) continue
    const token = `--color-${nome}`
    const existe = tema.cores[token] !== undefined
    if (opacidade === undefined) {
      if (existe) achadas.push({ classe, token, alfa: 1 })
      continue
    }
    if (!existe) {
      throw new Error(
        `Classe de texto "${classe}" aponta para o token "${token}", que não existe na ` +
          'cascata de CSS do app. Ou a classe está errada, ou o token é novo e precisa ' +
          'entrar no tema — em nenhum dos dois casos o contraste pode ser ignorado.',
      )
    }
    achadas.push({ classe, token, alfa: Number(opacidade) / 100 })
  }
  return achadas
}

/** `true` se o elemento (ou um ancestral) está marcado como decorativo. */
export function ehDecorativo(elemento: Element): boolean {
  let atual: Element | null = elemento
  while (atual !== null) {
    if (atual.getAttribute('aria-hidden') === 'true') return true
    atual = atual.parentElement
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Fundo — modela o que sabe, RECUSA o que não sabe, lança no que está errado
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * O resultado de resolver um fundo. `cores` traz **uma ou mais** superfícies: mais de uma
 * quando o fundo é um gradiente, caso em que cada parada é um cenário a medir.
 */
export type FundoResolvido =
  | { tipo: 'cores'; hexes: string[] }
  | { tipo: 'recusa'; motivo: string }

const REGEX_FUNDO_COM_ALFA = /(?:^|\s)bg-([a-z0-9-]+)(?:\/(\d{1,3}))?(?=\s|$)/g
/** `bg-[#3d5566]` e também `bg-radial-[at_50%]` / `bg-linear-[45deg]` (v4). */
const REGEX_FUNDO_ARBITRARIO = /(?:^|\s)bg-(?:[a-z0-9-]*-)?\[/
/**
 * Gradientes **nativos** do Tailwind: as paradas moram em `from-*`/`via-*`/`to-*`, que não
 * são tokens de fundo. São classes **legítimas e corretas** — recusar é o certo; lançar
 * tiraria a tela inteira da varredura, que é o defeito que manteve a `Sidebar` sem medição.
 */
const REGEX_GRADIENTE_NATIVO =
  /^(?:(?:gradient|linear)-to-(?:t|tr|r|br|b|bl|l|tl)|linear-\d{1,3}|radial|conic(?:-\d{1,3})?)$/
const REGEX_OPACIDADE = /(?:^|\s)opacity-(\d{1,3})(?=\s|$)/g
const REGEX_HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
const REGEX_DIRECAO_DE_GRADIENTE =
  /^(to\s+[a-z\s]+|-?\d+(\.\d+)?(deg|rad|grad|turn)|in\s+.+|circle\b.*|ellipse\b.*|at\s+.+|from\s+.+)$/i
const REGEX_PARADA_POSICIONAL = /(-?\d+(\.\d+)?(%|px|r?em|vw|vh|deg)|calc\([^)]*\))/gi

/** Classes de fundo que não pintam nada — a busca continua no ancestral. */
const FUNDOS_TRANSPARENTES = new Set(['transparent', 'inherit', 'none'])

/** Valores inline que declaram fundo/cor mas não pintam nada. */
const VALORES_INLINE_NEUTROS = new Set(['none', 'transparent', 'inherit', 'initial', 'unset'])

/** O fator de `opacity-NN` do elemento (1 quando não há a classe). */
export function opacidadeDoElemento(className: string): number {
  let fator = 1
  for (const casamento of className.matchAll(REGEX_OPACIDADE)) {
    fator *= Number(casamento[1]) / 100
  }
  return fator
}

/** Divide por vírgulas de TOPO — `rgba(7, 75, 127, .2)` é um item só, não quatro. */
function separarPorVirgulaDeTopo(texto: string): string[] {
  const partes: string[] = []
  let profundidade = 0
  let atual = ''
  for (const caractere of texto) {
    if (caractere === '(') profundidade += 1
    if (caractere === ')') profundidade -= 1
    if (caractere === ',' && profundidade === 0) {
      partes.push(atual)
      atual = ''
      continue
    }
    atual += caractere
  }
  partes.push(atual)
  return partes.map((parte) => parte.trim()).filter((parte) => parte !== '')
}

function normalizarHexDeParada(hex: string): string {
  const cru = hex.toLowerCase()
  if (cru.length === 7) return cru
  return `#${cru[1]}${cru[1]}${cru[2]}${cru[2]}${cru[3]}${cru[3]}`
}

/**
 * As paradas de cor de um `background-image`, ou a RECUSA explícita quando o valor não é um
 * gradiente de paradas hexadecimais.
 *
 * O veredito de contraste sobre um gradiente é o do **pior ponto**, então cada parada vira
 * um cenário de medição. Parada com alfa (`rgba`), indireção (`var`) ou imagem (`url`) não
 * é modelável sem simular a pilha inteira de pintura — e adivinhar ali é exatamente o
 * defeito que este medidor existe para não cometer.
 */
export function paradasDeGradiente(valor: string): FundoResolvido {
  const abre = valor.indexOf('(')
  const nome = (abre === -1 ? valor : valor.slice(0, abre)).trim()
  if (abre === -1 || !/^(repeating-)?(linear|radial|conic)-gradient$/i.test(nome)) {
    return {
      tipo: 'recusa',
      motivo:
        `fundo em imagem "${valor}" não é um gradiente de paradas de cor — o contraste ` +
        'sobre ele não é derivável do CSS, e presumir um fundo é o defeito que este ' +
        'medidor existe para não cometer.',
    }
  }
  const segmentos = separarPorVirgulaDeTopo(valor.slice(abre + 1, valor.lastIndexOf(')')))
  const hexes: string[] = []
  for (const [indice, segmento] of segmentos.entries()) {
    if (indice === 0 && REGEX_DIRECAO_DE_GRADIENTE.test(segmento)) continue
    const semPosicao = segmento.replace(REGEX_PARADA_POSICIONAL, ' ').trim()
    const achados = semPosicao.match(REGEX_HEX) ?? []
    if (achados.length !== 1 || semPosicao.replace(REGEX_HEX, ' ').trim() !== '') {
      return {
        tipo: 'recusa',
        motivo:
          `parada "${segmento}" do gradiente "${nome}(…)" não é uma cor hexadecimal — ` +
          'paradas com alfa (`rgba`), indireção (`var`) ou imagem (`url`) exigiriam ' +
          'simular a pilha de pintura inteira. O medidor RECUSA em vez de adivinhar.',
      }
    }
    hexes.push(normalizarHexDeParada(achados[0]))
  }
  if (hexes.length === 0) {
    return { tipo: 'recusa', motivo: `gradiente "${valor}" sem nenhuma parada de cor legível.` }
  }
  return { tipo: 'cores', hexes }
}

const REGEX_DECLARACAO_INLINE =
  /(?:^|;)\s*(background|background-color|background-image|color|opacity)\s*:\s*([^;]+)/gi

/** `opacity: 1` (ou `100%`) não compõe nada — recusar ali cegaria a varredura de graça. */
const OPACIDADES_INLINE_NEUTRAS = new Set(['1', '1.0', '100%'])

/** `true` quando a declaração inline existe mas não muda o que é pintado. */
function declaracaoInlineNaoPinta(propriedade: string, valor: string): boolean {
  if (VALORES_INLINE_NEUTROS.has(valor)) return true
  return propriedade === 'opacity' && OPACIDADES_INLINE_NEUTRAS.has(valor)
}

/**
 * Cor, fundo **ou opacidade** declarados no atributo `style` — sempre RECUSA quando pintam
 * de fato: o valor mora no call site, não no CSS da cascata, então nada disso é derivável.
 * (`LineChartMovimentacao` põe `style={{ color: p.color }}` no tooltip; sem esta recusa o
 * texto seria medido com a cor do `body` — outra pergunta, respondida com confiança.)
 *
 * `opacity` entrou em 125/FE-A11Y-5: um `style={{opacity: 0.15}}` num ancestral é um
 * **grupo de pintura**, exatamente como `opacity-NN`, e não estava em lugar nenhum desta
 * lista. A mutação do QA que o pôs na mensagem do `EmptyState` (≈1,6:1 na tela, ilegível)
 * deixou a suíte **inteira verde**.
 */
export function declaracaoInlineNaoModelavel(elemento: Element): string | null {
  const estilo = elemento.getAttribute('style')
  if (estilo === null || estilo.trim() === '') return null
  for (const m of estilo.matchAll(REGEX_DECLARACAO_INLINE)) {
    const propriedade = m[1].toLowerCase()
    const valor = m[2].trim().toLowerCase()
    if (declaracaoInlineNaoPinta(propriedade, valor)) continue
    return (
      `<${elemento.tagName.toLowerCase()}> declara "${m[1]}: ${m[2].trim()}" no atributo ` +
      '`style`. O valor vem do call site, não do CSS da cascata — o medidor não o modela ' +
      'e RECUSA em vez de cair no fundo/cor padrão da página.'
    )
  }
  return null
}

/**
 * O fundo declarado no elemento (`bg-card`, `bg-border/50`, `bg-grad-escuro`), já composto
 * sobre `fundoAtual`. Devolve `[fundoAtual]` quando o elemento não pinta fundo, **mais de
 * um hex** quando o fundo é gradiente, e **recusa** quando não é modelável.
 *
 * **Lança** em `bg-<nome>` que não é nem token de cor, nem utilitário de imagem: isso é
 * classe errada ou token faltando, e nunca deve passar despercebido.
 */
export function fundoDoElemento(
  className: string,
  tema: TemaDeTexto,
  fundoAtual: string,
): FundoResolvido {
  if (REGEX_FUNDO_ARBITRARIO.test(className)) {
    return {
      tipo: 'recusa',
      motivo:
        `classe de fundo com valor arbitrário em "${className.trim()}" — o valor é do call ` +
        'site, não do tema, e o medidor RECUSA em vez de presumir o fundo da página.',
    }
  }
  for (const casamento of className.matchAll(REGEX_FUNDO_COM_ALFA)) {
    const [, nome, opacidade] = casamento
    if (FUNDOS_TRANSPARENTES.has(nome)) continue
    const alfa = opacidade === undefined ? 1 : Number(opacidade) / 100
    const hex = tema.cores[`--color-${nome}`]
    if (hex !== undefined) return { tipo: 'cores', hexes: [comAlfa(hex, fundoAtual, alfa)] }

    const imagem = tema.fundosDeImagem[`bg-${nome}`]
    if (imagem !== undefined) {
      const paradas = paradasDeGradiente(imagem)
      if (paradas.tipo === 'recusa') {
        return { tipo: 'recusa', motivo: `\`bg-${nome}\`: ${paradas.motivo}` }
      }
      return {
        tipo: 'cores',
        hexes: paradas.hexes.map((parada) => comAlfa(parada, fundoAtual, alfa)),
      }
    }
    if (REGEX_GRADIENTE_NATIVO.test(nome)) {
      return {
        tipo: 'recusa',
        motivo:
          `\`bg-${nome}\` é um gradiente nativo do Tailwind: as paradas de cor moram em ` +
          '`from-*`/`via-*`/`to-*`, que não são tokens de fundo, e o valor delas é do call ' +
          'site. O medidor RECUSA — lançar aqui tiraria a tela inteira da varredura, que é ' +
          'exatamente como a `Sidebar` ficou quatro unidades sem ser medida por ninguém.',
      }
    }
    throw new Error(
      `Classe de fundo "bg-${nome}" não corresponde a nenhum token da cascata ` +
        `("--color-${nome}") nem a nenhum utilitário de \`background-image\` ` +
        `(\`@utility bg-${nome}\`). O contraste do texto sobre ela não é mensurável — ` +
        'corrija a classe ou declare o token, nunca deixe passar.',
    )
  }
  return { tipo: 'cores', hexes: [fundoAtual] }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Padrões do `body`
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Os padrões do `body`, lidos da regra real do CSS — nunca digitados. */
export type PadroesDoBody = {
  /** Hex da cor de texto padrão (`body { color: var(--color-foreground) }`). */
  cor: string
  /** Hex do fundo padrão (`body { background-color: var(--color-background) }`). */
  fundo: string
}

const REGEX_BODY = /(^|\})\s*body\s*\{([^}]*)\}/
const REGEX_COR_DO_BODY = /(^|;)\s*color\s*:\s*var\(\s*(--color-[a-z0-9-]+)\s*\)/
const REGEX_FUNDO_DO_BODY = /(^|;)\s*background-color\s*:\s*var\(\s*(--color-[a-z0-9-]+)\s*\)/

/** Rótulo usado quando o texto herda a cor do `body` (nenhuma classe de cor na cadeia). */
export const CLASSE_DO_BODY = '(cor do body)'

/**
 * A cor e o fundo padrão do app, extraídos da regra `body` do CSS e resolvidos contra os
 * tokens. **Lança** se a regra sumir ou apontar token inexistente: sem eles, todo texto sem
 * classe de cor viraria "não sei medir" e a varredura ficaria vazia.
 */
export function padroesDoBody(conteudoCss: string, tokens: TokensDeCor): PadroesDoBody {
  const bloco = REGEX_BODY.exec(conteudoCss)
  if (bloco === null) {
    throw new Error(
      'Nenhuma regra `body { … }` encontrada no CSS do app — a cor e o fundo padrão do texto ' +
        'não são deriváveis, e presumi-los é exatamente o erro que este medidor existe para ' +
        'evitar.',
    )
  }
  const corpo = bloco[2]
  const cor = REGEX_COR_DO_BODY.exec(corpo)
  const fundo = REGEX_FUNDO_DO_BODY.exec(corpo)
  if (cor === null || fundo === null) {
    throw new Error(
      'A regra `body` não declara `color` e `background-color` via `var(--color-*)` — ' +
        `encontrado: ${corpo.trim()}`,
    )
  }
  const hexCor = tokens[cor[2]]
  const hexFundo = tokens[fundo[2]]
  if (hexCor === undefined || hexFundo === undefined) {
    throw new Error(
      `A regra \`body\` aponta para "${cor[2]}"/"${fundo[2]}", e ao menos um deles não existe ` +
        'na cascata de CSS do app.',
    )
  }
  return { cor: hexCor, fundo: hexFundo }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Varredura
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Uma medição, com a informação de onde a cor veio. */
export type MedidaHerdada = {
  /** Trecho do texto medido — a falha diz QUAL frase reprova. */
  texto: string
  /** A classe de cor que venceu (`text-foreground/70`) ou `'(cor do body)'`. */
  classe: string
  /** `true` quando a cor veio de um ancestral, não do elemento com o texto. */
  herdada: boolean
  /** Hex do texto já composto (opacidade da classe + grupos `opacity-*`). */
  corComposta: string
  /** Hex do fundo efetivo, já composto do mesmo jeito. */
  fundo: string
  razao: number
}

/** O que a varredura não soube medir — nunca some em silêncio. */
export type PuloDeVarredura = {
  texto: string
  motivo: string
}

export type VarreduraDeContraste = {
  medidas: MedidaHerdada[]
  pulados: PuloDeVarredura[]
}

function classesDe(elemento: Element): string | null {
  return typeof elemento.className === 'string' ? elemento.className : null
}

/** A cadeia do ancestral mais externo até o próprio elemento. */
function cadeiaDeAncestrais(elemento: Element): Element[] {
  const cadeia: Element[] = []
  let atual: Element | null = elemento
  while (atual !== null) {
    cadeia.unshift(atual)
    atual = atual.parentElement
  }
  return cadeia
}

export type Grupo = { opacidade: number; fundoExterno: string }

/**
 * Um cenário de pintura completo: o fundo opaco atrás do texto e os grupos `opacity-*` que
 * ainda compõem por cima. Um fundo em gradiente produz **um cenário por parada** — é assim
 * que o pior ponto entra na medição em vez de ser escolhido a dedo.
 */
export type Cenario = { fundoLocal: string; grupos: Grupo[] }

export type ContextoDePintura =
  | { tipo: 'cenarios'; cenarios: Cenario[] }
  | { tipo: 'recusa'; motivo: string }

function deduplicar(cenarios: readonly Cenario[]): Cenario[] {
  const vistos = new Map<string, Cenario>()
  for (const cenario of cenarios) vistos.set(JSON.stringify(cenario), cenario)
  return Array.from(vistos.values())
}

/**
 * Os cenários de pintura do elemento: fundo local + grupos de opacidade acima dele.
 *
 * **Exportada em 126/FE-FOCO** para que o medidor do anel de foco
 * (`utils/contrasteDoAnelDeFoco.ts`) use **este** modelo de fundo em vez de reimplementar
 * um. A pergunta do anel é outra (indicador não-textual, piso 3:1), mas o fundo atrás dele
 * é o mesmo fundo — e dois modelos de fundo mantidos em paralelo divergem, que foi
 * exatamente a dívida `Q-2` que a 125 fechou.
 */
export function contextoDePintura(
  elemento: Element,
  tema: TemaDeTexto,
  fundoPadrao: string,
): ContextoDePintura {
  let cenarios: Cenario[] = [{ fundoLocal: fundoPadrao, grupos: [] }]
  for (const no of cadeiaDeAncestrais(elemento)) {
    const inline = declaracaoInlineNaoModelavel(no)
    if (inline !== null) return { tipo: 'recusa', motivo: inline }

    const classes = classesDe(no) ?? ''
    const opacidade = opacidadeDoElemento(classes)
    // O grupo compõe o que ELE pinta (inclusive o próprio fundo) sobre o que já havia atrás.
    if (opacidade < 1) {
      cenarios = cenarios.map((cenario) => ({
        fundoLocal: cenario.fundoLocal,
        grupos: [...cenario.grupos, { opacidade, fundoExterno: cenario.fundoLocal }],
      }))
    }

    const proximos: Cenario[] = []
    for (const cenario of cenarios) {
      const fundo = fundoDoElemento(classes, tema, cenario.fundoLocal)
      if (fundo.tipo === 'recusa') return { tipo: 'recusa', motivo: fundo.motivo }
      for (const hex of fundo.hexes) proximos.push({ fundoLocal: hex, grupos: cenario.grupos })
    }
    cenarios = deduplicar(proximos)
  }
  return { tipo: 'cenarios', cenarios }
}

type CoresVigentes =
  | { tipo: 'cores'; cores: CorDeTexto[]; herdada: boolean }
  | { tipo: 'recusa'; motivo: string }

/**
 * As cores de texto que valem para o elemento — as dele ou, se não tiver, as herdadas.
 *
 * A subida para quando o nó declara cor, como na cascata do navegador. Se o nó que declara
 * traz uma cor **não modelável**, a resposta é RECUSA e não a cor do avô: presumir a
 * herdada ali é o fallback silencioso do numerador (125/FE-A11Y-5).
 */
function coresVigentes(elemento: Element, tema: TemaDeTexto): CoresVigentes {
  let atual: Element | null = elemento
  while (atual !== null) {
    const classes = classesDe(atual)
    if (classes !== null) {
      const recusa = classeDeTextoNaoModelavel(classes, tema)
      if (recusa !== null) {
        return {
          tipo: 'recusa',
          motivo:
            atual === elemento ? recusa : `${recusa} (declarada num ancestral do texto)`,
        }
      }
      const cores = coresDeTextoDaClasse(classes, tema)
      if (cores.length > 0) return { tipo: 'cores', cores, herdada: atual !== elemento }
    }
    atual = atual.parentElement
  }
  return { tipo: 'cores', cores: [], herdada: true }
}

/** `true` se o elemento tem nó de texto próprio (não só filhos). */
function temTextoProprio(elemento: Element): boolean {
  return Array.from(elemento.childNodes).some(
    (no) => no.nodeType === 3 && (no.textContent ?? '').trim() !== '',
  )
}

/**
 * Mede TODO texto da árvore renderizada, herdando cor e fundo como o navegador herda.
 * Devolve também `pulados` — o que não soube medir aparece, nunca some.
 *
 * A raiz certa é o **`document.body`**: portais (`Modal`, `ConfirmDialog`, tooltip) montam
 * fora do container de `render()`, e uma varredura com a raiz errada mede zero texto e
 * "passa".
 */
export function medirTextosComHeranca(
  raiz: Element,
  opcoes: { tema: TemaDeTexto; padroes: PadroesDoBody },
): VarreduraDeContraste {
  const { tema, padroes } = opcoes
  const medidas: MedidaHerdada[] = []
  const pulados: PuloDeVarredura[] = []
  const elementos = [raiz, ...Array.from(raiz.querySelectorAll('*'))]

  for (const elemento of elementos) {
    if (!temTextoProprio(elemento) || ehDecorativo(elemento)) continue
    const texto = (elemento.textContent ?? '').trim().slice(0, 60)

    if (classesDe(elemento) === null) {
      pulados.push({
        texto,
        motivo:
          `<${elemento.tagName.toLowerCase()}> com texto próprio e \`className\` que não é ` +
          'string (SVG/MathML) — a classe de cor não é legível por este medidor.',
      })
      continue
    }

    const contexto = contextoDePintura(elemento, tema, padroes.fundo)
    if (contexto.tipo === 'recusa') {
      pulados.push({ texto, motivo: contexto.motivo })
      continue
    }

    const vigencia = coresVigentes(elemento, tema)
    if (vigencia.tipo === 'recusa') {
      pulados.push({ texto, motivo: vigencia.motivo })
      continue
    }
    const { cores, herdada } = vigencia
    const vigentes: (CorDeTexto | null)[] = cores.length > 0 ? cores : [null]

    for (const cor of vigentes) {
      for (const { fundoLocal, grupos } of contexto.cenarios) {
        const hexDoToken = cor === null ? padroes.cor : tema.cores[cor.token]
        const alfa = cor === null ? 1 : cor.alfa
        let corComposta = comAlfa(hexDoToken, fundoLocal, alfa)
        let fundo = fundoLocal
        // Desempilha os grupos do mais interno para o mais externo: cada um compõe o que já
        // foi pintado sobre o fundo que existia fora dele.
        for (let i = grupos.length - 1; i >= 0; i -= 1) {
          corComposta = comAlfa(corComposta, grupos[i].fundoExterno, grupos[i].opacidade)
          fundo = comAlfa(fundo, grupos[i].fundoExterno, grupos[i].opacidade)
        }
        medidas.push({
          texto,
          classe: cor === null ? CLASSE_DO_BODY : cor.classe,
          herdada: cor === null ? true : herdada,
          corComposta,
          fundo,
          razao: contrastRatio(corComposta, fundo),
        })
      }
    }
  }

  return { medidas, pulados }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Consultas sobre o resultado — o que os testes de tela usam para AFIRMAR O NÚMERO
// ═══════════════════════════════════════════════════════════════════════════════════════

/** As medições abaixo do piso AA, já formatadas para a mensagem de falha. */
export function reprovacoesAA(medidas: readonly MedidaHerdada[]): string[] {
  return medidas
    .filter((medida) => medida.razao < PISO_AA)
    .map(
      (medida) =>
        `${medida.classe}${medida.herdada ? ' (herdada)' : ''} ` +
        `(${medida.corComposta} sobre ${medida.fundo}) = ${medida.razao.toFixed(2)}:1 ` +
        `em "${medida.texto}"`,
    )
}

/** Atalho para o teste: a PIOR razão medida para uma classe (ou `undefined`). */
export function razaoDaClasse(
  medidas: readonly MedidaHerdada[],
  classe: string,
): number | undefined {
  const daClasse = medidas.filter((medida) => medida.classe === classe)
  return daClasse.length === 0 ? undefined : Math.min(...daClasse.map((m) => m.razao))
}

/**
 * A razão medida de uma frase específica da tela — é assim que o teste afirma **o número**,
 * e não só "não reprovou". É o **pior** cenário da frase (num fundo em gradiente, a parada
 * mais desfavorável). Falha alto quando a frase não é encontrada: uma asserção sobre
 * `undefined` é o modo silencioso de um teste destes morrer.
 */
export function razaoDoTexto(medidas: readonly MedidaHerdada[], trecho: string): number {
  const daFrase = medidas.filter((medida) => medida.texto.includes(trecho))
  if (daFrase.length === 0) {
    throw new Error(
      `Nenhum texto medido contém "${trecho}". Medidos: ` +
        medidas.map((m) => `"${m.texto}"`).join(', '),
    )
  }
  return Math.min(...daFrase.map((medida) => medida.razao))
}

/** As classes de cor que venceram na frase (para provar QUAL classe o DOM renderiza). */
export function classesDoTexto(medidas: readonly MedidaHerdada[], trecho: string): string[] {
  return Array.from(
    new Set(
      medidas.filter((medida) => medida.texto.includes(trecho)).map((medida) => medida.classe),
    ),
  )
}

/** Os fundos efetivos medidos na frase — provam contra quais cores o contraste foi calculado. */
export function fundoDoTexto(medidas: readonly MedidaHerdada[], trecho: string): string[] {
  return Array.from(
    new Set(medidas.filter((medida) => medida.texto.includes(trecho)).map((medida) => medida.fundo)),
  )
}

/**
 * As reprovações **entre as frases que a unidade alterou**, exigindo que cada uma tenha
 * sido de fato medida.
 *
 * Existe porque, quando esta função foi escrita (125/FE-A11Y-2), a tela inteira também
 * continha reprovações **pré-existentes e fora do escopo daquela unidade**. Travar a tela
 * inteira ali seria assumir dívida alheia; ignorar tudo seria não afirmar nada. O recorte é
 * **nominal, frase a frase**, e a busca faz a companheira positiva: se a frase não foi
 * medida, lança em vez de passar vazio.
 */
export function reprovacoesDasFrases(
  medidas: readonly MedidaHerdada[],
  frases: readonly string[],
): string[] {
  const doEscopo: MedidaHerdada[] = []
  for (const frase of frases) {
    const daFrase = medidas.filter((medida) => medida.texto.includes(frase))
    if (daFrase.length === 0) {
      throw new Error(
        `A frase "${frase}" não foi medida em lugar nenhum da árvore renderizada — sem ela ` +
          'esta asserção passaria vazia. Medidos: ' +
          medidas.map((m) => `"${m.texto}"`).join(', '),
      )
    }
    doEscopo.push(...daFrase)
  }
  return reprovacoesAA(doEscopo)
}

/** As classes da família `text-foreground` que a árvore de fato renderizou, sem repetição. */
export function classesForeground(medidas: readonly MedidaHerdada[]): string[] {
  return Array.from(
    new Set(
      medidas
        .map((medida) => medida.classe)
        .filter((classe) => /^text-foreground(\/\d+)?$/.test(classe)),
    ),
  ).sort()
}
