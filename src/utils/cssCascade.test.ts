/**
 * 123/FE-FIX4 (`F-9`) — o MECANISMO que deriva a cascata de CSS, provado sobre um
 * sistema de arquivos fabricado, e depois aplicado ao disco real.
 *
 * O que cada bloco existe para deixar VERMELHO (a pergunta de `rules/tests.md`):
 *
 *  1. **ordem** — `@import` aplicado depois do arquivo que o importa inverteria a
 *     precedência e faria a varredura ler o token errado como "o que vale".
 *  2. 🔴 **item novo entra sozinho** — um arquivo de tema acrescentado à cascata
 *     aparece na derivação **sem que nenhuma lista seja editada**. É a prova de que a
 *     enumeração deixou de ser mantida à mão (`rules/security.md`).
 *  3. **anti-vacuidade** — derivação vazia LANÇA. Conjunto vazio passa em qualquer
 *     invariante ("nenhum culpado" == "não varreu"), então nunca pode passar.
 *  4. **precisão, nunca frouxidão** — `@import` dentro de comentário não conta (o
 *     design system documenta os próprios imports em prosa, inclusive um que faria o
 *     arquivo importar a si mesmo), e o que a cascata não sabe classificar **lança**.
 *  5. **disco real** — a cascata deste repositório, derivada de `index.html` até a
 *     última folha, e a trava de que nenhum `.css` de `src/` fica fora dela.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  contarDeclaracoesPorArquivo,
  derivarCascataDeCssDoApp,
  derivarModuloDeEntrada,
  importsDeCss,
  lerTokensDeCor,
  normalizarHex,
  resolverEspecificadorDeCss,
  semComentariosDeCss,
} from './cssCascade'

/** Sistema de arquivos fabricado: o mecanismo é provado sem tocar no disco. */
function lerDe(arquivos: Record<string, string>): (caminho: string) => string {
  return (caminho: string): string => {
    const conteudo = arquivos[caminho]
    if (conteudo === undefined) throw new Error(`arquivo inexistente: ${caminho}`)
    return conteudo
  }
}

const FS_BASE: Record<string, string> = {
  'index.html': '<script type="module" src="/src/main.tsx"></script>',
  'src/main.tsx': "import './estilos/entrada.css'\n",
  'src/estilos/entrada.css': [
    "@import url('https://fonts.exemplo/fonte.css');",
    '@import "framework";',
    "@import '@escopo/ds/folha.css';",
    "@import './parcial.css';",
    '@theme { --color-app: #010203; }',
  ].join('\n'),
  'node_modules/framework/package.json': '{"exports":{".":{"style":"./index.css"}}}',
  'node_modules/framework/index.css': '@theme { --color-app: #ffffff; --color-fw: #fff; }',
  'node_modules/@escopo/ds/folha.css': "@import './tokens.css';\n@theme { --color-app: #0a0b0c; }",
  'node_modules/@escopo/ds/tokens.css': ':root { --color-ds: #ABCDEF; }',
  'src/estilos/parcial.css': ':root { --color-parcial: #123456; }',
}

describe('cssCascade — a cascata é DERIVADA do grafo real de @import', () => {
  it('deriva index.html -> módulo de entrada -> imports, com os imports ANTES do importador', () => {
    // Literal escrito à mão (nunca derivado da saída): expectativa derivada da própria
    // função seria tautologia. A ordem é a da precedência do CSS — o último vence.
    expect(derivarCascataDeCssDoApp(lerDe(FS_BASE))).toEqual([
      'node_modules/framework/index.css',
      'node_modules/@escopo/ds/tokens.css',
      'node_modules/@escopo/ds/folha.css',
      'src/estilos/parcial.css',
      'src/estilos/entrada.css',
    ])
  })

  it('🔴 um arquivo de tema NOVO entra sozinho — nenhuma lista é editada', () => {
    // É a prova do F-9: com a lista à mão, o arquivo novo nascia fora da varredura.
    const comTemaNovo: Record<string, string> = {
      ...FS_BASE,
      'src/estilos/entrada.css': `${FS_BASE['src/estilos/entrada.css']}\n@import './tema-escuro.css';`,
      'src/estilos/tema-escuro.css': '.dark { --color-tema-novo: #000000; }',
    }
    const cascata = derivarCascataDeCssDoApp(lerDe(comTemaNovo))

    expect(cascata).toContain('src/estilos/tema-escuro.css')
    // E o token declarado nele passa a ser visto pela varredura — que é o efeito que
    // faltava: antes, um `.dark` num arquivo fora da lista à mão passava batido.
    expect(lerTokensDeCor(cascata, lerDe(comTemaNovo))['--color-tema-novo']).toBe('#000000')
    // Companheira negativa, na MESMA execução: sem o arquivo novo o token não existe —
    // senão "vejo o token" seria indistinguível de "o token já estava lá".
    expect(
      lerTokensDeCor(derivarCascataDeCssDoApp(lerDe(FS_BASE)), lerDe(FS_BASE))['--color-tema-novo'],
    ).toBeUndefined()
  })

  it('anti-vacuidade: entrada sem CSS LANÇA, em vez de devolver cascata vazia', () => {
    const semCss: Record<string, string> = { ...FS_BASE, 'src/main.tsx': 'export const x = 1\n' }
    expect(() => derivarCascataDeCssDoApp(lerDe(semCss))).toThrow(/não importa nenhum \.css/)
  })

  it('anti-vacuidade: html sem (ou com mais de um) módulo de entrada LANÇA', () => {
    expect(() => derivarModuloDeEntrada(lerDe({ ...FS_BASE, 'index.html': '<html></html>' }))).toThrow(
      /declara 0 <script/,
    )
    const doisScripts =
      '<script type="module" src="/src/a.tsx"></script><script type="module" src="/src/b.tsx"></script>'
    expect(() =>
      derivarModuloDeEntrada(lerDe({ ...FS_BASE, 'index.html': doisScripts })),
    ).toThrow(/declara 2 <script/)
  })

  it('arquivo de tema que sumiu LANÇA (nunca é ignorado em silêncio)', () => {
    const semParcial: Record<string, string> = { ...FS_BASE }
    delete semParcial['src/estilos/parcial.css']
    expect(() => derivarCascataDeCssDoApp(lerDe(semParcial))).toThrow(/arquivo inexistente/)
  })

  it('ciclo de @import não trava nem duplica', () => {
    const comCiclo: Record<string, string> = {
      ...FS_BASE,
      'src/estilos/parcial.css': "@import './entrada.css';\n:root { --color-parcial: #123456; }",
    }
    const cascata = derivarCascataDeCssDoApp(lerDe(comCiclo))
    expect(new Set(cascata).size).toBe(cascata.length)
    expect(cascata).toContain('src/estilos/parcial.css')
  })
})

describe('cssCascade — precisão do detector de @import (nunca mais frouxo)', () => {
  it('@import dentro de COMENTÁRIO não entra na cascata', () => {
    // O caso real: `@migrate/design-system/styles.css` documenta em prosa
    // `@import "@migrate/design-system/styles.css";` — sem tirar comentários, o arquivo
    // importaria a si mesmo e um "fantasma" entraria na varredura.
    const conteudo = [
      '/* Uso:',
      ' *   @import "fantasma";',
      " *   @import './fantasma.css';",
      ' */',
      "@import './real.css';",
    ].join('\n')
    expect(importsDeCss('x.css', conteudo)).toEqual([{ especificador: './real.css', remoto: false }])
  })

  it('controle positivo: o mesmo detector ainda pega o import de verdade', () => {
    // Sem isto, "nenhum fantasma" seria indistinguível de "detector morto".
    expect(importsDeCss('x.css', "@import './real.css';")).toEqual([
      { especificador: './real.css', remoto: false },
    ])
    expect(semComentariosDeCss('/* a */b')).toBe('b')
  })

  it('fonte remota é classificada como remota e fica fora da cascata de arquivos', () => {
    const remotos = importsDeCss(
      'x.css',
      "@import url('https://fonts.exemplo/f.css');\n@import 'https://cdn.exemplo/t.css';",
    )
    expect(remotos.map((i) => i.remoto)).toEqual([true, true])
  })

  it('@import que a cascata não sabe classificar LANÇA', () => {
    expect(() => importsDeCss('x.css', '@import layer(base);')).toThrow(/NÃO CLASSIFICADO/)
    expect(() => importsDeCss('x.css', '@import "";')).toThrow(/especificador vazio/)
  })

  it('resolve relativo, subcaminho de pacote e pacote nu pelo campo style', () => {
    const ler = lerDe(FS_BASE)
    expect(resolverEspecificadorDeCss('src/estilos/entrada.css', './parcial.css', ler)).toBe(
      'src/estilos/parcial.css',
    )
    expect(resolverEspecificadorDeCss('src/estilos/a/b.css', '../c.css', ler)).toBe(
      'src/estilos/c.css',
    )
    expect(resolverEspecificadorDeCss('x.css', '@escopo/ds/folha.css', ler)).toBe(
      'node_modules/@escopo/ds/folha.css',
    )
    expect(resolverEspecificadorDeCss('x.css', 'framework', ler)).toBe(
      'node_modules/framework/index.css',
    )
  })

  it('pacote sem folha declarada, subcaminho sem .css e caminho absoluto LANÇAM', () => {
    const ler = lerDe({ ...FS_BASE, 'node_modules/mudo/package.json': '{"name":"mudo"}' })
    expect(() => resolverEspecificadorDeCss('x.css', 'mudo', ler)).toThrow(/não declara folha/)
    expect(() => resolverEspecificadorDeCss('x.css', 'framework/tema', ler)).toThrow(
      /subcaminho sem extensão/,
    )
    expect(() => resolverEspecificadorDeCss('x.css', '/tema.css', ler)).toThrow(/absoluto/)
  })
})

describe('cssCascade — leitura de tokens de cor', () => {
  it('o ÚLTIMO arquivo da cascata vence (é a precedência do CSS)', () => {
    const ler = lerDe(FS_BASE)
    const tokens = lerTokensDeCor(derivarCascataDeCssDoApp(ler), ler)
    // `--color-app` é declarado nos três: framework (#ffffff), ds (#0a0b0c) e entrada
    // (#010203). Vale o da entrada. Invertida a ordem, este assert fica vermelho.
    expect(tokens['--color-app']).toBe('#010203')
    expect(tokens['--color-ds']).toBe('#abcdef')
    expect(tokens['--color-parcial']).toBe('#123456')
  })

  it('hex de 3 dígitos é normalizado (senão a declaração some da varredura)', () => {
    expect(normalizarHex('#fff')).toBe('#ffffff')
    expect(normalizarHex('#ABCDEF')).toBe('#abcdef')
    expect(() => normalizarHex('rgb(0,0,0)')).toThrow(/não reconhecido/)
    const ler = lerDe(FS_BASE)
    // Controle sobre a cascata fabricada: `--color-fw: #fff` é lido, não ignorado.
    expect(lerTokensDeCor(derivarCascataDeCssDoApp(ler), ler)['--color-fw']).toBe('#ffffff')
  })

  it('conta as declarações POR ARQUIVO (é o que detecta um segundo tema no mesmo arquivo)', () => {
    const ler = lerDe(FS_BASE)
    const contagem = contarDeclaracoesPorArquivo(derivarCascataDeCssDoApp(ler), ler)
    expect(contagem['--color-app']).toEqual({
      'node_modules/framework/index.css': 1,
      'node_modules/@escopo/ds/folha.css': 1,
      'src/estilos/entrada.css': 1,
    })
  })
})

/* ── Disco real deste repositório ─────────────────────────────────────────────── */

const RAIZ = process.cwd()
const lerDoDisco = (caminho: string): string => readFileSync(resolve(RAIZ, caminho), 'utf8')

function listarCss(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) listarCss(caminho, acc)
    else if (entrada.name.endsWith('.css')) acc.push(relative(RAIZ, caminho).split('\\').join('/'))
  }
  return acc
}

describe('cssCascade — a cascata REAL deste repositório', () => {
  const CASCATA = derivarCascataDeCssDoApp(lerDoDisco)

  it('é exatamente esta, nesta ordem (identidade, nunca cardinalidade)', () => {
    // Lado DERIVADO do grafo real × lado LITERAL escrito à mão: um arquivo de tema que
    // entre, saia ou troque de posição reprova NOMEANDO o arquivo. A trava não é a
    // lista (essa é derivada) — é a mudança silenciosa do universo da varredura.
    expect(CASCATA).toEqual([
      'node_modules/tailwindcss/index.css',
      'node_modules/@migrate/design-system/tokens.css',
      'node_modules/@migrate/design-system/styles.css',
      'src/styles/global.css',
    ])
  })

  it('o F-9 está fechado: os 2 arquivos que faltavam à lista antiga estão na varredura', () => {
    // A lista à mão era [design-system/styles.css, src/styles/global.css]. `tokens.css`
    // (importado por styles.css) e o `index.css` do Tailwind ficavam de fora — um
    // `.dark { … }` em qualquer um dos dois passava batido pelo detector de tema.
    expect(CASCATA).toContain('node_modules/@migrate/design-system/tokens.css')
    expect(CASCATA).toContain('node_modules/tailwindcss/index.css')
  })

  it('todo .css de src/ está na cascata (nenhuma folha órfã fora da varredura)', () => {
    const naCascata = new Set(CASCATA)
    const orfaos = listarCss(resolve(RAIZ, 'src')).filter((css) => !naCascata.has(css))
    expect(
      orfaos,
      'Folha de estilo em src/ que a cascata derivada não alcança: ou ela é código morto ' +
        '(apague), ou o módulo de entrada precisa importá-la — enquanto estiver fora, os ' +
        'tokens dela não são medidos por nenhuma trava de contraste.',
    ).toEqual([])
    // Controle positivo: a varredura de disco enxerga alguma coisa.
    expect(listarCss(resolve(RAIZ, 'src')).length).toBeGreaterThan(0)
  })

  it('anti-vacuidade no disco real: a cascata não é vazia e termina na folha do app', () => {
    expect(CASCATA.length).toBeGreaterThanOrEqual(4)
    expect(CASCATA[CASCATA.length - 1]).toBe('src/styles/global.css')
  })
})
