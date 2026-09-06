/**
 * 123/FE-A2 + 123/FE-FIX3 — trava de contraste da família de tokens de ERRO
 * (`--color-error-fg`, achado `A-2`; `--color-error`, achado `F-1`).
 *
 * O que cada bloco prova, e o que o deixa VERMELHO:
 *
 *  1. **identidade do conjunto de pares** — os pares auditados são exatamente estes,
 *     por nome literal. Fica vermelho se um par entrar ou sair sem par de teste
 *     (`rules/tests.md` § "suíte parametrizada por enumeração encolhe em silêncio";
 *     cardinalidade não serve: passa quando um entra e outro sai).
 *  2. **piso AA** — cada par >= 4,5:1. Fica vermelho se alguém devolver
 *     `--color-error-fg` ou `--color-error` para `#ff0000` (4,00:1 sobre o card,
 *     3,24:1 sobre o `error-bg`/`alert-error`) ou escolher outro valor claro demais.
 *     **É esta a trava que impede a regressão dos achados `A-2` e `F-1`.**
 *  3. **espelho do CSS real** — o hex do módulo é DERIVADO de `global.css` + do
 *     `styles.css` do design system. Sem isto, mudar o token no CSS deixaria o teste
 *     medindo uma cor que não está mais na tela (continuaria verde medindo `#c00000`
 *     enquanto a app pintasse `#ff0000`).
 *  4. **controle positivo** — um par que REPROVA de verdade (`--color-warning-fg`
 *     sobre `--color-warning-bg` = 3,00:1, o par oficial do DS que motivou
 *     `AP-FRONTEND-018`) precisa ser detectado pela mesma função. Sem ele, "verde" é
 *     indistinguível de "cálculo inerte".
 *  5. **um tema por arquivo** — o app não tem tema escuro (verificado em 123/FE-A2:
 *     zero utilitários `dark:` em `src/`, nenhum bloco `.dark`, nenhum alternador).
 *     Este bloco trava esse fato pela **identidade dos arquivos que declaram cada
 *     token** e por **no máximo uma declaração por arquivo**: um `.dark { … }` dentro
 *     de `global.css` produz a segunda declaração e reprova NOMEANDO o token. A
 *     sobrescrita legítima de `--color-error` (DS declara, app sobrescreve) é
 *     **um arquivo cada**, e a identidade dos dois arquivos está travada.
 *  6. 🔴 **inventário DERIVADO de call sites (123/FE-FIX3, fecha `F-5`/`QMA2d`)** — o
 *     conjunto real de `arquivo::classe` é varrido de `src/**` e do bundle do DS e
 *     comparado com `CALL_SITES_DE_ERRO`. Fica vermelho quando um call site NOVO
 *     aparece, quando um some, e — o caso que 0 testes pegavam antes — quando um
 *     **migra** de `bg-error-fg` para `bg-error`. Cada classe derivada é medida contra
 *     o piso do seu papel, que sai do PREFIXO do utilitário, não de anotação à mão.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './colorContrast'
import {
  ALERTA_CONTRAST_PAIRS,
  CALL_SITES_DE_ERRO,
  EXCLUSOES_NOMINAIS_DA_VARREDURA,
  PAPEL_POR_PREFIXO,
  PISO_WCAG_NAO_TEXTUAL,
  PISO_WCAG_TEXTO,
  REGEX_CALL_SITE_DE_ERRO,
  SUPERFICIES_CLARAS,
  TOKENS_DE_SUPERFICIE_DE_ERRO,
  papelDaClasse,
  pisoDoPapel,
  reprovacoesDaClasse,
  tokenDaClasse,
} from './alertTokenContrast'
import {
  contarDeclaracoesPorArquivo,
  derivarCascataDeCssDoApp,
  lerTokensDeCor,
} from './cssCascade'

/** Piso WCAG do papel — importado da produção e TRAVADO por teste próprio (ver F-7). */
const PISO_AA = PISO_WCAG_TEXTO

/**
 * 123/FE-FIX4 (`F-9`) — a cascata de CSS é **derivada** do grafo real de `@import`
 * (`index.html` → `src/main.tsx` → `global.css` → …), nunca digitada aqui. A lista à
 * mão que estava neste arquivo tinha 2 dos 4 arquivos da cascata: `tokens.css` do
 * design system e o `index.css` do Tailwind ficavam de fora, e um token (ou um bloco
 * `.dark`) declarado neles não era visto por trava nenhuma.
 * O mecanismo tem prova própria em `cssCascade.test.ts`.
 */
const lerDoDisco = (caminho: string): string => readFileSync(resolve(process.cwd(), caminho), 'utf8')
const CASCATA_CSS = derivarCascataDeCssDoApp(lerDoDisco)

const TOKENS = lerTokensDeCor(CASCATA_CSS, lerDoDisco)
const DECLARACOES = contarDeclaracoesPorArquivo(CASCATA_CSS, lerDoDisco)

describe('alertTokenContrast — piso AA de 4.5:1 para a família de tokens de erro (123/FE-A2 A-2, 123/FE-FIX3 F-1)', () => {
  it('o conjunto de pares auditados é exatamente o esperado (não encolhe em silêncio)', () => {
    expect(new Set(ALERTA_CONTRAST_PAIRS.map((p) => p.label))).toEqual(
      new Set([
        'erro inline / ação destrutiva — error-fg sobre o card',
        'badge/toast de erro — error-fg sobre error-bg',
        'error-fg sobre o fundo geral da página',
        'botão de descarte — branco sobre error-fg como FUNDO sólido',
        'validação inline do design system — error sobre o card',
        'badge/alerta do design system — error sobre alert-error',
        'error sobre o fundo geral da página',
        'botão destrutivo — branco sobre error como FUNDO sólido',
      ]),
    )
  })

  it.each(ALERTA_CONTRAST_PAIRS)('o par $label atinge ao menos 4.5:1', ({ fg, bg, label }) => {
    const razao = contrastRatio(fg, bg)
    expect(
      razao,
      `${label}: ${fg} sobre ${bg} = ${razao.toFixed(2)}:1 (piso ${PISO_AA}:1). ` +
        'O achado A-2 era exatamente isto com #ff0000 (4.00:1 sobre o card) e o F-1 ' +
        'era o mesmo no token irmão --color-error (3.24:1 sobre o alert-error). ' +
        'Não afrouxe o piso: escureça o token.',
    ).toBeGreaterThanOrEqual(PISO_AA)
  })

  it.each(ALERTA_CONTRAST_PAIRS)(
    'o hex do par $label é o mesmo do CSS real (module x global.css/DS)',
    ({ fgToken, bgToken, fg, bg }) => {
      expect(TOKENS[fgToken], `token ${fgToken} não encontrado no CSS`).toBeDefined()
      expect(TOKENS[bgToken], `token ${bgToken} não encontrado no CSS`).toBeDefined()
      expect(TOKENS[fgToken]).toBe(fg.toLowerCase())
      expect(TOKENS[bgToken]).toBe(bg.toLowerCase())
    },
  )

  it('mede o CSS real com a mesma fórmula: passa hoje, e o valor histórico reprovaria', () => {
    // Positiva sobre o valor REAL lido do arquivo (não sobre o espelho do módulo),
    // nos DOIS tokens da família — foi a ausência do segundo que produziu o F-1.
    expect(contrastRatio(TOKENS['--color-error-fg'], TOKENS['--color-card'])).toBeGreaterThanOrEqual(
      PISO_AA,
    )
    expect(contrastRatio(TOKENS['--color-error'], TOKENS['--color-card'])).toBeGreaterThanOrEqual(
      PISO_AA,
    )
    expect(
      contrastRatio(TOKENS['--color-error'], TOKENS['--color-alert-error']),
    ).toBeGreaterThanOrEqual(PISO_AA)

    // Companheira negativa com o valor HISTÓRICO, escrito à mão: prova que o cálculo
    // discrimina, e documenta os números dos achados A-2 (4,00:1) e F-1 (3,24:1).
    const antigo = contrastRatio('#ff0000', '#ffffff')
    expect(antigo).toBeLessThan(PISO_AA)
    expect(antigo).toBeCloseTo(4.0, 1)
    const antigoNoAlerta = contrastRatio('#ff0000', '#ffe0e0')
    expect(antigoNoAlerta).toBeLessThan(PISO_AA)
    expect(antigoNoAlerta).toBeCloseTo(3.24, 1)
  })

  it('reprova um par fabricado abaixo do piso (controle positivo do detector)', () => {
    // `--color-warning-fg` sobre `--color-warning-bg` — o par oficial do DS que
    // continua reprovando (AP-FRONTEND-018). Se este assert deixar de valer, o
    // cálculo virou inerte e todos os verdes acima não significam nada.
    const razao = contrastRatio('#e07600', '#fffbef')
    expect(razao).toBeLessThan(PISO_AA)
    expect(razao).toBeCloseTo(3.0, 1)
  })
})

describe('alertTokenContrast — o app tem UM tema (se ganhar outro, meça os pares nele)', () => {
  const tokensDoInventario = Array.from(
    new Set(ALERTA_CONTRAST_PAIRS.flatMap((p) => [p.fgToken, p.bgToken])),
  )

  it.each(tokensDoInventario)(
    '%s é declarado no máximo uma vez POR ARQUIVO de tema',
    (token) => {
      const porArquivo = DECLARACOES[token] ?? {}
      const duplicados = Object.entries(porArquivo).filter(([, n]) => n > 1)
      expect(
        duplicados,
        `${token} tem mais de uma declaração no mesmo arquivo. Se um segundo tema ` +
          '(ex.: um bloco .dark) foi introduzido, os pares de ALERTA_CONTRAST_PAIRS ' +
          'precisam ser medidos NELE também — acrescente as entradas do tema novo em ' +
          'vez de afrouxar esta trava.',
      ).toEqual([])
    },
  )

  it('os arquivos que declaram cada token da família de erro são exatamente os esperados', () => {
    // Identidade, não cardinalidade: um terceiro arquivo de tema declarando o token
    // (ou a sobrescrita do app desaparecendo) reprova NOMEANDO o token.
    // `--color-error` é declarado DUAS vezes de propósito: o DS traz #ff0000 e o app
    // sobrescreve para #c00000 (123/FE-FIX3, achado F-1). Se a linha do app sumir, a
    // lista abaixo encolhe e este teste fica vermelho — junto com o piso AA.
    expect(Object.keys(DECLARACOES['--color-error'] ?? {}).sort()).toEqual([
      'node_modules/@migrate/design-system/styles.css',
      'src/styles/global.css',
    ])
    expect(Object.keys(DECLARACOES['--color-error-fg'] ?? {})).toEqual(['src/styles/global.css'])
    expect(Object.keys(DECLARACOES['--color-error-bg'] ?? {})).toEqual(['src/styles/global.css'])
    expect(Object.keys(DECLARACOES['--color-alert-error'] ?? {})).toEqual([
      'node_modules/@migrate/design-system/styles.css',
    ])
  })

  it('nenhum arquivo de tema do app declara um segundo tema (.dark / [data-theme] / prefers-color-scheme)', () => {
    const seletorDeTema = () =>
      /(^|\})\s*(\.dark\b|\[data-theme|@media[^{]*prefers-color-scheme)/m

    // Universo = a cascata DERIVADA (123/FE-FIX4, `F-9`): inclui os arquivos que a
    // lista à mão não alcançava, que é exatamente onde um segundo tema passaria batido.
    const culpados = CASCATA_CSS.filter((arquivo) => seletorDeTema().test(lerDoDisco(arquivo)))
    expect(
      culpados,
      'Um segundo tema apareceu nestes arquivos. Meça os pares de ALERTA_CONTRAST_PAIRS ' +
        'no tema novo e acrescente-os ao inventário — contraste que passa no claro pode ' +
        'reprovar no escuro.',
    ).toEqual([])

    // Controle positivo do detector: a mesma regex PEGA blocos de tema fabricados.
    // Sem isto, "nenhum culpado" seria indistinguível de "regex morta".
    expect(seletorDeTema().test('a{color:red}\n.dark { --color-error-fg: #ff5555; }')).toBe(true)
    expect(seletorDeTema().test('@media (prefers-color-scheme: dark) { :root { } }')).toBe(true)
  })
})

/* ────────────────────────────────────────────────────────────────────────────────────
 * 123/FE-FIX3 — o inventário de call sites é DERIVADO da fonte (fecha F-5 / QMA2d)
 * ──────────────────────────────────────────────────────────────────────────────────── */

/** Definição de "arquivo de teste" do próprio runner (`include` default do Vitest 4). */
const EH_ARQUIVO_DE_TESTE = /\.(test|spec)\.[cm]?[jt]sx?$/
const EH_FONTE = /\.[cm]?[jt]sx?$/
const BARRA_INVERTIDA = String.fromCharCode(92)

function paraPosix(caminho: string): string {
  return caminho.split(BARRA_INVERTIDA).join('/')
}

/** Todos os arquivos de fonte sob `dir`, recursivamente — enumerado do disco. */
function listarFontes(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) listarFontes(caminho, acc)
    else if (EH_FONTE.test(entrada.name)) acc.push(caminho)
  }
  return acc
}

export type CallSiteDerivado = { arquivo: string; linha: number; classe: string }

/** Varre um conteúdo e devolve as classes da família de erro, com linha. */
function varrerConteudo(arquivo: string, conteudo: string): CallSiteDerivado[] {
  const achados: CallSiteDerivado[] = []
  conteudo.split(/\r?\n/).forEach((linha, i) => {
    // Instância nova a cada linha: RegExp global carrega `lastIndex`.
    for (const m of linha.matchAll(new RegExp(REGEX_CALL_SITE_DE_ERRO, 'g'))) {
      achados.push({ arquivo, linha: i + 1, classe: m[0] })
    }
  })
  return achados
}

const EXCLUIDOS = new Set(EXCLUSOES_NOMINAIS_DA_VARREDURA.map((e) => e.arquivo))

/** O universo: código de produção do app + os componentes compilados do design system. */
function varrerCallSitesDeErro(): CallSiteDerivado[] {
  const raiz = process.cwd()
  const arquivos = [
    ...listarFontes(resolve(raiz, 'src')),
    resolve(raiz, 'node_modules/@migrate/design-system/dist/index.js'),
  ]
  const achados: CallSiteDerivado[] = []
  for (const absoluto of arquivos) {
    const relativo = paraPosix(relative(raiz, absoluto))
    if (EH_ARQUIVO_DE_TESTE.test(relativo) || EXCLUIDOS.has(relativo)) continue
    achados.push(...varrerConteudo(relativo, readFileSync(absoluto, 'utf8')))
  }
  return achados
}

const DERIVADOS = varrerCallSitesDeErro()

/** `arquivo::classe`, sem repetição e ordenado — a chave da asserção de identidade. */
function chaves(lista: { arquivo: string; classe: string }[]): string[] {
  return Array.from(new Set(lista.map((c) => `${c.arquivo}::${c.classe}`))).sort()
}

describe('alertTokenContrast — call sites DERIVADOS da fonte (123/FE-FIX3, fecha F-5/QMA2d)', () => {
  it('a varredura encontra call sites de verdade (não é uma regex morta)', () => {
    // Sem este controle positivo, todos os asserts abaixo passariam com a varredura
    // devolvendo vazio — "nenhuma divergência" seria indistinguível de "não varreu".
    expect(DERIVADOS.length).toBeGreaterThan(20)
    expect(
      DERIVADOS.some(
        (c) => c.arquivo === 'node_modules/@migrate/design-system/dist/index.js' && c.classe === 'text-error',
      ),
      'a varredura precisa alcançar o bundle do design system — é lá que vive o achado F-1',
    ).toBe(true)
    expect(
      DERIVADOS.some((c) => c.arquivo.startsWith('src/') && c.classe === 'text-error-fg'),
      'a varredura precisa alcançar src/ — é lá que vivem os call sites do achado A-2',
    ).toBe(true)
  })

  it('🔴 o conjunto de call sites é exatamente o inventariado (arquivo::classe)', () => {
    const esperado = chaves(
      CALL_SITES_DE_ERRO.flatMap((entrada) =>
        entrada.classes.map((classe) => ({ arquivo: entrada.arquivo, classe })),
      ),
    )
    expect(
      chaves(DERIVADOS),
      'Um call site da família `error` entrou, saiu ou MIGROU de token sem passar pelo ' +
        'inventário. Foi exatamente isto que a mutação QMA2d do QA explorou: trocar ' +
        '`bg-error-fg` por `bg-error` num diálogo não deixava nenhum teste vermelho. ' +
        'Acrescente a entrada em CALL_SITES_DE_ERRO com o `porque` escrito — e confira ' +
        'que o par (token × superfície) está em ALERTA_CONTRAST_PAIRS.',
    ).toEqual(esperado)
  })

  it('cada entrada do inventário declara suas classes ordenadas e sem repetição', () => {
    for (const entrada of CALL_SITES_DE_ERRO) {
      expect(entrada.classes, `${entrada.arquivo}: classes fora de ordem ou repetidas`).toEqual(
        Array.from(new Set(entrada.classes)).sort(),
      )
      expect(entrada.porque.length, `${entrada.arquivo}: entrada sem justificativa`).toBeGreaterThan(
        20,
      )
    }
  })

  it('toda classe derivada é medida contra o piso do seu papel (papel vem do PREFIXO)', () => {
    const classes = Array.from(new Set(DERIVADOS.map((c) => c.classe))).sort()
    expect(classes.length, 'nenhuma classe derivada — varredura inerte').toBeGreaterThan(0)

    const reprovados: string[] = []
    for (const classe of classes) {
      const token = tokenDaClasse(classe)
      const hex = TOKENS[token]
      expect(hex, `token ${token} (de "${classe}") não encontrado no CSS real`).toBeDefined()
      // 123/FE-FIX4 (`F-7`): a régua (papel → piso → medição) mora na produção e tem
      // teste próprio, com identidade do mapa e controle positivo. Antes ela era escrita
      // aqui, e o piso saía da mesma função que este teste mede.
      reprovados.push(...reprovacoesDaClasse(classe, hex, SUPERFICIES_CLARAS))
    }

    expect(
      reprovados,
      'Classes da família de erro abaixo do piso WCAG do seu papel. Escureça o token — ' +
        'nunca afrouxe o piso nem tire o call site da varredura.',
    ).toEqual([])
  })

  it('o hex de cada superfície clara é o do CSS real', () => {
    for (const superficie of SUPERFICIES_CLARAS) {
      expect(TOKENS[superficie.token], `${superficie.token} ausente do CSS`).toBe(superficie.hex)
    }
  })

  it('a regex de call site é PRECISA: pega o que deve e recusa o que parece', () => {
    const casa = (texto: string): boolean => new RegExp(REGEX_CALL_SITE_DE_ERRO).test(texto)
    const casou = (texto: string): string[] =>
      Array.from(texto.matchAll(new RegExp(REGEX_CALL_SITE_DE_ERRO, 'g'))).map((m) => m[0])

    // Positivos — as quatro formas da família.
    expect(casou('className="text-error"')).toEqual(['text-error'])
    expect(casou('className="bg-error text-white"')).toEqual(['bg-error'])
    expect(casou('className="bg-error-bg text-error-fg"')).toEqual(['bg-error-bg', 'text-error-fg'])
    expect(casou('error: "bg-alert-error text-error"')).toEqual(['bg-alert-error', 'text-error'])
    // Com modificador de variante e de opacidade, como aparecem no código real.
    expect(casa('hover:border-error')).toBe(true)
    expect(casou('border-error-fg/30')).toEqual(['border-error-fg'])

    // Negativos — sufixo alheio não pode ser lido como o token curto (AP-QA-008:
    // detector mais PRECISO, nunca mais frouxo).
    expect(casou('bg-error-bg')).not.toContain('bg-error')
    expect(casa('text-errors')).toBe(false)
    expect(casa('text-error-inesperado')).toBe(false)
    expect(casa('id="campo-error"')).toBe(false)
  })

  it('a exclusão da varredura é NOMINAL, item por item, com justificativa', () => {
    // `rules/security.md`: exclusão por PADRÃO DE NOME é regra sobre como o nome se
    // parece; a nominal é sobre o que a coisa é. Se esta lista crescer, cada entrada
    // nova tem de trazer o porquê — e a identidade dela fica travada aqui.
    expect(EXCLUSOES_NOMINAIS_DA_VARREDURA.map((e) => e.arquivo)).toEqual([
      'src/utils/alertTokenContrast.ts',
    ])
    for (const exclusao of EXCLUSOES_NOMINAIS_DA_VARREDURA) {
      expect(exclusao.porque.length, `${exclusao.arquivo}: exclusão sem justificativa`).toBeGreaterThan(
        20,
      )
    }
  })
})

/* ────────────────────────────────────────────────────────────────────────────────────
 * 123/FE-FIX4 — a RÉGUA do invariante derivado tem teste próprio (fecha `F-7`)
 *
 * O QA da rodada 4 mediu: trocar `PAPEL_POR_PREFIXO.text` de `'texto'` para `'borda'`
 * derrubava o piso de 27 pares `arquivo::classe` de 4,5:1 para 3:1 com **0 testes
 * vermelhos** — porque a expectativa do invariante derivado (o piso) saía da mesma
 * função de produção que ele mede, e essa função não tinha um único teste seu.
 * É `AP-QA-029` uma camada acima: ali era o **seed**, aqui é o **critério**.
 *
 * Este bloco fecha nas duas classes:
 *  · **forma**  — identidade do mapa e de cada papel, com literais escritos à mão;
 *  · **efeito** — um call site FABRICADO no valor do próprio achado (`#ff0000`) tem de
 *    reprovar. Com o piso derrubado para 3:1 ele passaria, e o assert fica vermelho.
 * ──────────────────────────────────────────────────────────────────────────────────── */

describe('alertTokenContrast — papel e piso, a régua do invariante derivado (123/FE-FIX4, F-7)', () => {
  it('🔴 o mapa prefixo → papel é EXATAMENTE este (identidade, literais à mão)', () => {
    // Trocar o papel de QUALQUER prefixo reprova aqui — inclusive a mutação medida pelo
    // QA (`text: 'texto'` → `'borda'`), que era a que sobrevivia com 0 fallers.
    expect(PAPEL_POR_PREFIXO).toEqual({
      text: 'texto',
      bg: 'fundo-solido',
      border: 'borda',
      ring: 'borda',
      outline: 'borda',
      divide: 'borda',
      decoration: 'borda',
      accent: 'fundo-solido',
      caret: 'borda',
      placeholder: 'texto',
      fill: 'texto',
      stroke: 'borda',
      shadow: 'borda',
    })
  })

  it('as duas enumerações de prefixo não divergem: a do mapa é a da REGEX', () => {
    // A regex diz o que a varredura ENCONTRA; o mapa diz com que piso aquilo é MEDIDO.
    // Mantidas à mão em dois lugares, elas divergem — a única questão é quando. Aqui o
    // lado esquerdo é DERIVADO da regex de produção.
    const grupo = /\(([a-z|]+)\)/.exec(REGEX_CALL_SITE_DE_ERRO)
    expect(
      grupo,
      'a regex de call site mudou de forma: o grupo de prefixos não foi encontrado',
    ).not.toBeNull()
    const prefixosDaRegex = (grupo as RegExpExecArray)[1].split('|')
    // Anti-vacuidade: lista vazia (ou de um item só) casaria com quase qualquer coisa.
    expect(prefixosDaRegex.length).toBeGreaterThan(5)
    expect(new Set(prefixosDaRegex)).toEqual(new Set(Object.keys(PAPEL_POR_PREFIXO)))
  })

  it('cada prefixo produz o papel escrito à mão (super-aproximação deliberada inclusa)', () => {
    expect(papelDaClasse('text-error')).toBe('texto')
    expect(papelDaClasse('text-error-fg')).toBe('texto')
    expect(papelDaClasse('placeholder-error-fg')).toBe('texto')
    // Ícone pintado com `fill-` é julgado como TEXTO de propósito: reprovar ícone é
    // barato, aprovar texto ilegível não é.
    expect(papelDaClasse('fill-error')).toBe('texto')
    expect(papelDaClasse('bg-error')).toBe('fundo-solido')
    expect(papelDaClasse('accent-error')).toBe('fundo-solido')
    expect(papelDaClasse('border-error')).toBe('borda')
    expect(papelDaClasse('ring-error-fg')).toBe('borda')
    expect(papelDaClasse('stroke-error')).toBe('borda')
    expect(papelDaClasse('shadow-error')).toBe('borda')
    expect(papelDaClasse('caret-error')).toBe('borda')
    expect(papelDaClasse('divide-error')).toBe('borda')
    expect(papelDaClasse('outline-error')).toBe('borda')
    expect(papelDaClasse('decoration-error')).toBe('borda')
  })

  it('o token de SUPERFÍCIE só muda o papel de `bg-` — tinta continua tinta', () => {
    expect([...TOKENS_DE_SUPERFICIE_DE_ERRO]).toEqual(['error-bg', 'alert-error'])
    expect(papelDaClasse('bg-error-bg')).toBe('superficie')
    expect(papelDaClasse('bg-alert-error')).toBe('superficie')
    // Companheira negativa: `text-error-bg` usa o mesmo token e continua sendo TEXTO
    // (piso 4,5:1). Sem este assert, "é superfície" poderia estar valendo pelo sufixo.
    expect(papelDaClasse('text-error-bg')).toBe('texto')
    expect(papelDaClasse('border-alert-error')).toBe('borda')
  })

  it('prefixo desconhecido LANÇA — call site sem papel nunca é medido em silêncio', () => {
    expect(() => papelDaClasse('gradient-error')).toThrow(/PAPEL_POR_PREFIXO/)
  })

  it('🔴 o piso de cada papel é o número WCAG escrito à mão', () => {
    expect(PISO_WCAG_TEXTO).toBe(4.5)
    expect(PISO_WCAG_NAO_TEXTUAL).toBe(3)
    expect(pisoDoPapel('texto')).toBe(4.5)
    // Fundo sólido é medido como BRANCO SOBRE o token: o que se julga ali é texto.
    expect(pisoDoPapel('fundo-solido')).toBe(4.5)
    expect(pisoDoPapel('borda')).toBe(3)
    expect(() => pisoDoPapel('superficie')).toThrow(/piso próprio/)
  })

  it('🔴 CONTROLE POSITIVO do piso: texto a 4,00:1 REPROVA nas quatro superfícies', () => {
    // `#ff0000` é o valor do próprio achado (A-2/F-1): 4,00 sobre o card, 3,62 sobre o
    // fundo da página, 3,24 sobre os dois fundos de alerta. Com o piso de texto caído
    // para 3:1 (a mutação do QA) TODOS passariam, e este assert fica vermelho.
    const reprovacoes = reprovacoesDaClasse('text-error', '#ff0000', SUPERFICIES_CLARAS)
    expect(reprovacoes).toHaveLength(SUPERFICIES_CLARAS.length)
    expect(reprovacoes.join(' | ')).toContain('--color-card')
  })

  it('controle positivo de que a trava não morreu: o valor REAL do token passa', () => {
    // Se este ficasse vermelho, o detector estaria reprovando tudo — e "reprova sempre"
    // é tão inútil quanto "aprova sempre".
    expect(reprovacoesDaClasse('text-error', TOKENS['--color-error'], SUPERFICIES_CLARAS)).toEqual(
      [],
    )
    expect(reprovacoesDaClasse('bg-error', TOKENS['--color-error'], SUPERFICIES_CLARAS)).toEqual([])
  })

  it('os dois pisos DISCRIMINAM: 4,00:1 reprova como texto e passa como borda', () => {
    // Se os dois pisos fossem iguais, o mapa de papéis não teria efeito nenhum e o
    // controle positivo acima passaria pelo motivo errado.
    expect(reprovacoesDaClasse('border-error', '#ff0000', SUPERFICIES_CLARAS)).toEqual([])
    // ... e abaixo de 3:1 a borda também morde (o piso não-textual não é decorativo).
    expect(reprovacoesDaClasse('border-error', '#ffee00', SUPERFICIES_CLARAS)).toHaveLength(
      SUPERFICIES_CLARAS.length,
    )
  })

  it('fundo sólido é medido como BRANCO sobre o token (não o contrário)', () => {
    // `bg-error` a `#ff0000` dá 4,00:1 com o texto branco — o achado AP-FRONTEND-015.
    const reprovacoes = reprovacoesDaClasse('bg-error', '#ff0000', SUPERFICIES_CLARAS)
    expect(reprovacoes).toHaveLength(1)
    expect(reprovacoes[0]).toContain('branco')
  })

  it('superfície fora do inventário de fundos claros REPROVA nomeando a classe', () => {
    // Positivo: o fundo está auditado -> nada a reprovar.
    expect(reprovacoesDaClasse('bg-error-bg', '#ffe0e0', SUPERFICIES_CLARAS)).toEqual([])
    // Negativo, na MESMA execução: com o fundo fora da lista, reprova — senão "lista
    // vazia de reprovações" seria indistinguível de "este ramo não mede nada".
    const semAquelaSuperficie = [{ token: '--color-card', hex: '#ffffff' }]
    const fora = reprovacoesDaClasse('bg-error-bg', '#ffe0e0', semAquelaSuperficie)
    expect(fora).toHaveLength(1)
    expect(fora[0]).toContain('bg-error-bg')
  })
})
