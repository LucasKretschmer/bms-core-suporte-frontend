/**
 * 123/FE-FIX4 (achado `F-9` do QA da rodada 4) — a CASCATA de CSS do app, **derivada
 * do grafo real de `@import`**, nunca mantida à mão.
 *
 * ## Por que este módulo existe
 *
 * Duas travas de contraste (`utils/alertTokenContrast.test.ts` e
 * `features/reports/shared/utils/faturamentoTheme.test.ts`) leem os tokens
 * `--color-*: #hex` do CSS real para provar que o hex espelhado em TypeScript é o que
 * a app pinta. Cada uma mantinha **a sua própria lista** de arquivos de tema:
 *
 * ```
 * const ARQUIVOS_CSS = ['node_modules/@migrate/design-system/styles.css', 'src/styles/global.css']
 * ```
 *
 * Duas listas à mão sobre o mesmo conjunto — e as duas erradas do mesmo jeito: a
 * cascata real tem mais arquivos, porque `styles.css` abre com `@import './tokens.css'`
 * e `global.css` abre com `@import "tailwindcss"`. Um token (ou um bloco `.dark`)
 * declarado nesses arquivos **não era visto por nenhuma das duas**, em silêncio.
 *
 * `rules/security.md` § "Invariante de segurança e a enumeração que lhe dá poder":
 * *nenhuma enumeração que dá poder a um invariante é mantida à mão — derive em runtime
 * da fonte real*. A fonte real aqui é o grafo de `@import`, e a raiz dele é o
 * `<script type="module">` do `index.html` (o que o Vite de fato empacota), não um
 * caminho digitado.
 *
 * ## Precisão, nunca frouxidão
 *
 * O `@import` é lido **depois de remover os comentários**. Sem isso a varredura
 * "encontraria" os `@import` que a documentação do design system cita **dentro de um
 * bloco de comentário** — inclusive um `@import "@migrate/design-system/styles.css"`
 * que faria o arquivo importar a si mesmo. É o mesmo erro de `padrao in fonte` sobre
 * código: comentário não é código (`rules/security.md`).
 *
 * Import que este módulo não souber classificar **lança** — nunca é ignorado. É o que
 * garante que um arquivo de tema novo entre na varredura em vez de nascer fora dela.
 *
 * Módulo puro de propósito: quem lê o disco é injetado (`LerArquivo`). Assim o
 * mecanismo é testável com um sistema de arquivos fabricado, e nenhum `node:fs` entra
 * no grafo de módulos do app.
 */

/** Lê um arquivo pelo caminho POSIX relativo à raiz do projeto. Deve LANÇAR se não existir. */
export type LerArquivo = (caminho: string) => string

/** Um `@import` encontrado num arquivo CSS, já classificado. */
export type ImportDeCss = {
  /** O que veio entre aspas (ou o `url(...)` cru, quando remoto). */
  especificador: string
  /** `true` para fonte externa (`url(...)`, `http(s):`) — não entra na cascata de arquivos. */
  remoto: boolean
}

/** Caminho do `index.html` — a raiz do bundle, conforme o `root` padrão do Vite. */
export const HTML_DE_ENTRADA = 'index.html'

const REGEX_COMENTARIO_CSS = /\/\*[\s\S]*?\*\//g
const REGEX_AT_IMPORT = '@import\\s+([^;]*);'
const REGEX_SCRIPT_MODULO = /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/g
const REGEX_IMPORT_DE_CSS_EM_MODULO = /import\s+['"]([^'"]+\.css)['"]/g

/** Fonte da regex de token de cor. String para que cada uso construa a sua instância. */
export const REGEX_TOKEN_DE_COR =
  '(--color-[a-z0-9-]+)\\s*:\\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\\s*;'

/** Remove blocos de comentário — comentário não é declaração nem import. */
export function semComentariosDeCss(conteudo: string): string {
  return conteudo.replace(REGEX_COMENTARIO_CSS, '')
}

/** `#abc` -> `#aabbcc`; qualquer hex -> minúsculo. Lança em formato desconhecido. */
export function normalizarHex(hex: string): string {
  const cru = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(cru)) return cru
  if (/^#[0-9a-f]{3}$/.test(cru)) {
    return `#${cru[1]}${cru[1]}${cru[2]}${cru[2]}${cru[3]}${cru[3]}`
  }
  throw new Error(`Hex de token não reconhecido: "${hex}"`)
}

function dirPosix(caminho: string): string {
  const corte = caminho.lastIndexOf('/')
  return corte === -1 ? '' : caminho.slice(0, corte)
}

function juntarPosix(dir: string, relativo: string): string {
  const partes = dir === '' ? [] : dir.split('/')
  for (const parte of relativo.split('/')) {
    if (parte === '' || parte === '.') continue
    if (parte === '..') {
      if (partes.length === 0) {
        throw new Error(`@import sobe acima da raiz do projeto: "${dir}" + "${relativo}"`)
      }
      partes.pop()
      continue
    }
    partes.push(parte)
  }
  return partes.join('/')
}

function textoEm(valor: unknown, caminho: readonly string[]): string | undefined {
  let atual: unknown = valor
  for (const chave of caminho) {
    if (typeof atual !== 'object' || atual === null) return undefined
    atual = (atual as Record<string, unknown>)[chave]
  }
  return typeof atual === 'string' ? atual : undefined
}

/**
 * Os `@import` de um arquivo CSS, classificados. **Lança** no que não souber
 * classificar — um import ilegível é um arquivo de tema fora da varredura, e a regra
 * do projeto é falhar, nunca ignorar.
 */
export function importsDeCss(arquivo: string, conteudo: string): ImportDeCss[] {
  const achados: ImportDeCss[] = []
  for (const m of semComentariosDeCss(conteudo).matchAll(new RegExp(REGEX_AT_IMPORT, 'g'))) {
    const argumento = m[1].trim()
    if (/^url\(/i.test(argumento)) {
      achados.push({ especificador: argumento, remoto: true })
      continue
    }
    const citado = /^(['"])([^'"]*)\1/.exec(argumento)
    if (citado === null) {
      throw new Error(
        `@import NÃO CLASSIFICADO em "${arquivo}": ${argumento}. Um import que a cascata ` +
          'não sabe resolver é um arquivo de tema fora da varredura de contraste — ' +
          'classifique-o aqui (ou torne o import literal) em vez de deixá-lo passar.',
      )
    }
    const especificador = citado[2].trim()
    if (especificador === '') {
      throw new Error(`@import com especificador vazio em "${arquivo}".`)
    }
    achados.push({ especificador, remoto: /^https?:/i.test(especificador) })
  }
  return achados
}

/**
 * Especificador de `@import` -> caminho POSIX a partir da raiz do projeto.
 * Resolve relativo, subcaminho de pacote (`@escopo/pkg/arquivo.css`) e pacote nu
 * (pelo campo `exports['.'].style` / `style` do `package.json`, que é como o Tailwind
 * v4 publica o `index.css`).
 */
export function resolverEspecificadorDeCss(
  importador: string,
  especificador: string,
  ler: LerArquivo,
): string {
  if (especificador.startsWith('./') || especificador.startsWith('../')) {
    return juntarPosix(dirPosix(importador), especificador)
  }
  if (especificador.startsWith('/')) {
    throw new Error(
      `@import absoluto não classificado em "${importador}": "${especificador}". ` +
        'Use caminho relativo ou especificador de pacote.',
    )
  }
  if (especificador.endsWith('.css')) return `node_modules/${especificador}`

  const partes = especificador.split('/')
  const nomeDoPacote = especificador.startsWith('@') ? partes.slice(0, 2).join('/') : partes[0]
  if (nomeDoPacote !== especificador) {
    throw new Error(
      `@import de subcaminho sem extensão .css em "${importador}": "${especificador}". ` +
        'Não dá para saber que arquivo entra na cascata — aponte o .css explicitamente.',
    )
  }
  const pkg: unknown = JSON.parse(ler(`node_modules/${nomeDoPacote}/package.json`))
  const style = textoEm(pkg, ['exports', '.', 'style']) ?? textoEm(pkg, ['style'])
  if (style === undefined) {
    throw new Error(
      `O pacote "${nomeDoPacote}", importado por "${importador}", não declara folha de ` +
        'estilo (exports["."].style nem style) — não é possível derivar a cascata.',
    )
  }
  return juntarPosix(`node_modules/${nomeDoPacote}`, style)
}

/**
 * A cascata completa, na ORDEM em que o navegador aplica: os `@import` de um arquivo
 * vêm antes do próprio arquivo (por isso o último elemento é sempre a entrada, e é ela
 * que sobrescreve). Ciclo não trava: arquivo já visitado é ignorado.
 */
export function derivarCascataDeCss(entradas: readonly string[], ler: LerArquivo): string[] {
  const vistos = new Set<string>()
  const saida: string[] = []

  const visitar = (arquivo: string): void => {
    if (vistos.has(arquivo)) return
    vistos.add(arquivo)
    for (const imp of importsDeCss(arquivo, ler(arquivo))) {
      if (imp.remoto) continue
      visitar(resolverEspecificadorDeCss(arquivo, imp.especificador, ler))
    }
    saida.push(arquivo)
  }

  for (const entrada of entradas) visitar(entrada)
  return saida
}

/** O módulo de entrada do bundle, lido do `<script type="module">` do `index.html`. */
export function derivarModuloDeEntrada(ler: LerArquivo, html: string = HTML_DE_ENTRADA): string {
  const srcs = Array.from(ler(html).matchAll(REGEX_SCRIPT_MODULO)).map((m) => m[1])
  if (srcs.length !== 1) {
    throw new Error(
      `${html} declara ${srcs.length} <script type="module"> — a cascata de CSS é derivada ` +
        'da entrada única do bundle. Declare qual é a entrada em vez de adivinhar.',
    )
  }
  return srcs[0].replace(/^\.?\//, '')
}

/** Os `import './x.css'` do módulo de entrada, na ordem em que aparecem. */
export function derivarEntradasDeCss(moduloDeEntrada: string, ler: LerArquivo): string[] {
  const conteudo = ler(moduloDeEntrada)
  const achados = Array.from(conteudo.matchAll(REGEX_IMPORT_DE_CSS_EM_MODULO)).map((m) =>
    m[1].startsWith('.') ? juntarPosix(dirPosix(moduloDeEntrada), m[1]) : `node_modules/${m[1]}`,
  )
  if (achados.length === 0) {
    throw new Error(
      `"${moduloDeEntrada}" não importa nenhum .css — a cascata sairia VAZIA, e uma ` +
        'varredura vazia passa em qualquer invariante. Aponte a folha de entrada.',
    )
  }
  return achados
}

/**
 * A cascata do app inteira, derivada de ponta a ponta:
 * `index.html` -> módulo de entrada -> `@import` recursivos.
 * Nenhum caminho de arquivo de tema é digitado.
 */
export function derivarCascataDeCssDoApp(ler: LerArquivo): string[] {
  const cascata = derivarCascataDeCss(derivarEntradasDeCss(derivarModuloDeEntrada(ler), ler), ler)
  if (cascata.length === 0) {
    throw new Error('Cascata de CSS derivada VAZIA — varredura inerte, nunca aprove.')
  }
  return cascata
}

/** `--color-*: #hex;` de toda a cascata, na ordem de precedência (o último vence). */
export function lerTokensDeCor(
  cascata: readonly string[],
  ler: LerArquivo,
): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const arquivo of cascata) {
    for (const m of ler(arquivo).matchAll(new RegExp(REGEX_TOKEN_DE_COR, 'g'))) {
      tokens[m[1]] = normalizarHex(m[2])
    }
  }
  return tokens
}

/** Quantas vezes cada token é declarado, POR ARQUIVO da cascata. */
export function contarDeclaracoesPorArquivo(
  cascata: readonly string[],
  ler: LerArquivo,
): Record<string, Record<string, number>> {
  const contagem: Record<string, Record<string, number>> = {}
  for (const arquivo of cascata) {
    for (const m of ler(arquivo).matchAll(new RegExp(REGEX_TOKEN_DE_COR, 'g'))) {
      contagem[m[1]] ??= {}
      contagem[m[1]][arquivo] = (contagem[m[1]][arquivo] ?? 0) + 1
    }
  }
  return contagem
}
