import { contrastRatio } from '../../../utils/colorContrast'

/**
 * 124/FE-FIX2 (achados `D-2` e `D-3` do QA de frontend) — medidor de contraste **do DOM
 * renderizado**, não da classe que o componente pretendia usar.
 *
 * ## Por que a distinção importa (é o defeito D-2 inteiro)
 *
 * O `EmptyState` compartilhado põe a mensagem num `<p>` **interno** com
 * `text-xs italic text-primary/30`. O `className` passado ao wrapper vai para o `<div>` de
 * fora e **não alcança** esse `<p>`. Quem revisa lendo o JSX da tela vê uma classe; o
 * usuário lê outra — foi assim que 1,84:1 passou por três unidades da mesma demanda.
 * Por isso a medição parte da **árvore renderizada**, e as duas pontas são derivadas: a
 * classe vem do DOM e o hex vem do CSS real (`utils/cssCascade.ts`).
 *
 * ## O fundo também é derivado, não presumido
 *
 * A cor efetiva de `text-foreground/70` depende do que está atrás: sobre `--color-card`
 * (#ffffff) mede 5,47:1 e sobre `--color-background` (#f0f4f7) mede 5,20:1 — os dois
 * passam, mas `/60` passa num e reprova no outro (4,04:1 × 3,88:1). `fundoEfetivo` sobe a
 * cadeia de ancestrais do elemento procurando a primeira classe `bg-*`, que é o que o
 * navegador faz.
 *
 * ## O que entra na varredura, e por quê
 *
 * - Só elementos com **texto próprio**: contraste de texto se mede onde há texto. Ícone
 *   decorativo (`text-border` num `<span aria-hidden>`) não é texto e não tem piso AA.
 * - Nada sob `aria-hidden="true"`: é conteúdo **declarado decorativo** pelo próprio
 *   componente (o separador `•` do `Breadcrumb`, por exemplo). O critério é **semântico**,
 *   lido do DOM — nunca "este elemento parece decorativo" (`AP-FRONTEND-027`). Marcar
 *   conteúdo real como `aria-hidden` é outro defeito, de leitor de tela, não de contraste.
 * - Classe **com opacidade** (`text-x/70`) é sempre cor: se o token não existir na
 *   cascata, **lança** — nunca ignora.
 * - Classe `text-x` só é cor quando `--color-x` existe na cascata **e `--text-x` não
 *   existe**. O `text-*` do Tailwind v4 é um namespace COMPARTILHADO entre cor e tamanho
 *   de fonte, e o design system tem os dois: `--text-card: 16px` (tamanho) e
 *   `--color-card: #ffffff` (cor). Sem essa desambiguação, o `<h2 class="text-card">` do
 *   `Modal` era medido como "branco sobre branco = 1,00:1" — falso positivo que empurraria
 *   o próximo a afrouxar a trava. Quem decide continua sendo o CSS do app, agora nos DOIS
 *   namespaces; nenhuma lista de utilitários é escrita à mão.
 * - Variantes (`dark:`, `hover:`) ficam de fora — o QA mediu o tema claro, e afirmar
 *   sobre o escuro sem medir seria pior do que não afirmar.
 *
 * Módulo puro: os hexes entram por parâmetro. Quem lê o CSS do disco é o teste.
 */

/** `--color-foreground` -> `#002f4f`. Vem de `utils/cssCascade.ts::lerTokensDeCor`. */
export type TokensDeCor = Readonly<Record<string, string>>

/**
 * O tema, nos dois namespaces que a classe `text-*` divide. Os dois vêm da cascata real.
 */
export type TemaDeTexto = {
  cores: TokensDeCor
  /** Nomes com `--text-<nome>` declarado (tamanho de fonte): `card`, `body`, `aux`… */
  tamanhosDeTexto: ReadonlySet<string>
}

const REGEX_TAMANHO_DE_TEXTO = /--text-([a-z0-9-]+)\s*:/g

/** Os nomes do namespace `--text-*` (tamanho de fonte) declarados num CSS. */
export function nomesDeTamanhoDeTexto(conteudoCss: string): string[] {
  return Array.from(conteudoCss.matchAll(REGEX_TAMANHO_DE_TEXTO)).map((m) => m[1])
}

/**
 * O tema montado a partir da cascata real de CSS — as duas pontas derivadas, nenhuma
 * digitada. `cascata` vem de `cssCascade.derivarCascataDeCssDoApp`.
 */
export function temaDaCascata(
  cascata: readonly string[],
  ler: (caminho: string) => string,
  cores: TokensDeCor,
): TemaDeTexto {
  const tamanhos = new Set<string>()
  for (const arquivo of cascata) {
    for (const nome of nomesDeTamanhoDeTexto(ler(arquivo))) tamanhos.add(nome)
  }
  if (tamanhos.size === 0) {
    throw new Error(
      'Nenhum token `--text-*` encontrado na cascata — sem eles a desambiguação entre ' +
        'cor e tamanho de fonte fica inerte, e `text-card` volta a ser medido como cor.',
    )
  }
  return { cores, tamanhosDeTexto: tamanhos }
}

/** Uma cor de texto encontrada no DOM. */
export type CorDeTexto = {
  /** A classe crua, como está no elemento: `text-foreground/70`. */
  classe: string
  /** Token resolvido: `--color-foreground`. */
  token: string
  /** Opacidade em 0–1 (1 quando a classe não traz `/NN`). */
  alfa: number
}

/** Uma medição feita sobre um nó de texto realmente renderizado. */
export type MedidaDeContraste = {
  /** Trecho do texto, para a falha dizer QUAL frase reprova. */
  texto: string
  classe: string
  /** Hex do texto já composto sobre o fundo. */
  corComposta: string
  /** Hex do fundo efetivo. */
  fundo: string
  razao: number
}

/** Piso WCAG AA para texto normal. */
export const PISO_AA = 4.5

const REGEX_CLASSE_DE_TEXTO = /(?:^|\s)(text-([a-z0-9-]+)(?:\/(\d{1,3}))?)(?=\s|$)/g
const REGEX_FUNDO = /(?:^|\s)bg-([a-z0-9-]+)(?=\s|$)/g

/** Classes de fundo que não pintam nada — a busca continua no ancestral. */
const FUNDOS_TRANSPARENTES = new Set(['transparent', 'inherit', 'none'])

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

/** As cores de texto declaradas numa lista de classes (ver regras no cabeçalho). */
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

/**
 * O fundo EFETIVAMENTE atrás do elemento: a primeira classe `bg-*` subindo a cadeia de
 * ancestrais, ou `fundoPadrao` (o `<body>`) quando não há nenhuma.
 */
export function fundoEfetivo(elemento: Element, tokens: TokensDeCor, fundoPadrao: string): string {
  let atual: Element | null = elemento
  while (atual !== null) {
    const classes = typeof atual.className === 'string' ? atual.className : ''
    for (const casamento of classes.matchAll(REGEX_FUNDO)) {
      const nome = casamento[1]
      if (FUNDOS_TRANSPARENTES.has(nome)) continue
      const token = `--color-${nome}`
      const hex = tokens[token]
      if (hex === undefined) {
        throw new Error(
          `Classe de fundo "bg-${nome}" não corresponde a nenhum token da cascata ` +
            `("${token}"). O contraste do texto sobre ela não é mensurável — corrija a ` +
            'classe ou declare o token, nunca deixe passar.',
        )
      }
      return hex
    }
    atual = atual.parentElement
  }
  return fundoPadrao
}

/** `true` se o elemento tem nó de texto próprio (não só filhos). */
function temTextoProprio(elemento: Element): boolean {
  return Array.from(elemento.childNodes).some(
    (no) => no.nodeType === 3 && (no.textContent ?? '').trim() !== '',
  )
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

/**
 * Mede TODO texto colorido da árvore renderizada. Devolve as medições — nunca só as
 * falhas — para que o teste possa afirmar também o lado positivo (que mediu alguma coisa).
 */
export function medirTextosDoDom(
  raiz: Element,
  opcoes: { tema: TemaDeTexto; fundoPadrao: string },
): MedidaDeContraste[] {
  const medidas: MedidaDeContraste[] = []
  const elementos = [raiz, ...Array.from(raiz.querySelectorAll('*'))]

  for (const elemento of elementos) {
    if (!temTextoProprio(elemento) || ehDecorativo(elemento)) continue
    const classes = typeof elemento.className === 'string' ? elemento.className : ''
    for (const cor of coresDeTextoDaClasse(classes, opcoes.tema)) {
      const fundo = fundoEfetivo(elemento, opcoes.tema.cores, opcoes.fundoPadrao)
      const corComposta = comAlfa(opcoes.tema.cores[cor.token], fundo, cor.alfa)
      medidas.push({
        texto: (elemento.textContent ?? '').trim().slice(0, 60),
        classe: cor.classe,
        corComposta,
        fundo,
        razao: contrastRatio(corComposta, fundo),
      })
    }
  }
  return medidas
}

/** As medições abaixo do piso AA, já formatadas para a mensagem de falha. */
export function reprovacoesAA(medidas: readonly MedidaDeContraste[]): string[] {
  return medidas
    .filter((medida) => medida.razao < PISO_AA)
    .map(
      (medida) =>
        `${medida.classe} (${medida.corComposta} sobre ${medida.fundo}) = ` +
        `${medida.razao.toFixed(2)}:1 em "${medida.texto}"`,
    )
}
