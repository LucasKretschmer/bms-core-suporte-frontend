import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { derivarCascataDeCssDoApp, lerTokensDeCor } from './cssCascade'
import {
  CLASSE_DO_BODY,
  PISO_AA,
  comAlfa,
  classeDeTextoNaoModelavel,
  coresDeTextoDaClasse,
  customPropertiesDoCss,
  declaracaoInlineNaoModelavel,
  fundoDoElemento,
  medirTextosComHeranca,
  opacidadeDoElemento,
  padroesDoBody,
  paradasDeGradiente,
  razaoDaClasse,
  razaoDoTexto,
  reprovacoesAA,
  temaDaCascata,
  utilitariosDeImagemDoCss,
} from './contrasteDeTexto'

/**
 * **CONTROLE POSITIVO do medidor consolidado** (125/FE-A11Y-4, `Q-2` + `Q-3`).
 *
 * Um "0 reprovações" nas telas só vale alguma coisa se este arquivo provar, na mesma
 * execução, que o medidor **reprova** o que sabidamente reprova e **aprova** o que
 * sabidamente passa — nos cinco modos de composição que ele modela (classe direta,
 * herança, fundo com alfa, grupo `opacity-*` e gradiente) — e que ele **RECUSA**, em vez
 * de cair no fundo da página, tudo o que não sabe modelar.
 *
 * Este arquivo é a união dos dois arquivos de teste que existiam antes da consolidação:
 * `features/support-plans/utils/contrasteDeTexto.test.ts` (124/FE-FIX2) e
 * `utils/contrasteHerdadoDoDom.test.ts` (125/FE-A11Y-2). **Nenhum caso foi perdido** — a
 * consolidação não pode custar capacidade, e é este arquivo que prova isso.
 *
 * Todos os hexes vêm da cascata real de CSS; nenhum é digitado aqui.
 */

const lerDoDisco = (caminho: string): string => readFileSync(resolve(process.cwd(), caminho), 'utf8')
const CASCATA_CSS = derivarCascataDeCssDoApp(lerDoDisco)
const TOKENS = lerTokensDeCor(CASCATA_CSS, lerDoDisco)
const TEMA = temaDaCascata(CASCATA_CSS, lerDoDisco, TOKENS)
const CSS_DO_APP = CASCATA_CSS.map(lerDoDisco).join('\n')
const PADROES = padroesDoBody(CSS_DO_APP, TOKENS)

function elementoCom(html: string): HTMLElement {
  const raiz = document.createElement('div')
  raiz.innerHTML = html
  return raiz
}

function medir(html: string) {
  return medirTextosComHeranca(elementoCom(html), { tema: TEMA, padroes: PADROES })
}

function alvoDe(html: string): Element {
  const alvo = elementoCom(html).querySelector('#alvo')
  if (alvo === null) throw new Error('O fixture precisa ter um elemento #alvo.')
  return alvo
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Tema — os três namespaces derivados da cascata
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('tokens lidos da cascata real', () => {
  it('os três tokens usados na tela de planos existem no CSS do app', () => {
    expect(TOKENS['--color-foreground']).toMatch(/^#[0-9a-f]{6}$/)
    expect(TOKENS['--color-card']).toMatch(/^#[0-9a-f]{6}$/)
    expect(TOKENS['--color-background']).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('coresDeTextoDaClasse', () => {
  it('lê a opacidade e resolve o token', () => {
    expect(coresDeTextoDaClasse('mt-2 text-sm text-foreground/70', TEMA)).toEqual([
      { classe: 'text-foreground/70', token: '--color-foreground', alfa: 0.7 },
    ])
  })

  it('classe de cor sem opacidade vale como opaca', () => {
    expect(coresDeTextoDaClasse('text-base font-medium text-foreground', TEMA)).toEqual([
      { classe: 'text-foreground', token: '--color-foreground', alfa: 1 },
    ])
  })

  it('utilitário de tamanho/alinhamento NÃO é confundido com cor', () => {
    // Quem separa `text-sm` de `text-foreground` é a existência do token na cascata —
    // nenhuma lista de utilitários escrita à mão.
    expect(coresDeTextoDaClasse('text-xs text-center text-left italic', TEMA)).toEqual([])
  })

  it('`text-card` é TAMANHO de fonte, não a cor do card (namespace compartilhado)', () => {
    // Achado real da 124: `--text-card: 16px` e `--color-card: #ffffff` coexistem, e o
    // `<h2 class="text-card font-medium text-primary">` do `Modal` era medido como
    // "branco sobre branco = 1,00:1". Quem desambigua é o CSS, não uma lista.
    expect(TEMA.tamanhosDeTexto.has('card')).toBe(true)
    expect(coresDeTextoDaClasse('text-card font-medium text-primary', TEMA)).toEqual([
      { classe: 'text-primary', token: '--color-primary', alfa: 1 },
    ])
  })

  it('LANÇA quando a classe tem opacidade e o token não existe — nunca ignora', () => {
    expect(() => coresDeTextoDaClasse('text-forground/70', TEMA)).toThrow(/não existe na cascata/)
  })
})

describe('padroesDoBody — derivados da regra real, nunca digitados', () => {
  it('lê `color` e `background-color` do `body` e resolve os tokens', () => {
    expect(PADROES.cor).toBe(TOKENS['--color-foreground'])
    expect(PADROES.fundo).toBe(TOKENS['--color-background'])
  })

  it('LANÇA quando o CSS não tem regra `body` — nunca presume o padrão', () => {
    expect(() => padroesDoBody('h1 { color: red; }', TOKENS)).toThrow(/Nenhuma regra `body {/)
  })

  it('LANÇA quando o `body` não declara os dois via var(--color-*)', () => {
    expect(() => padroesDoBody('body { color: #123456; }', TOKENS)).toThrow(/não declara/)
  })

  it('LANÇA quando o token do `body` não existe na cascata', () => {
    expect(() =>
      padroesDoBody(
        'body { color: var(--color-fantasma); background-color: var(--color-card); }',
        TOKENS,
      ),
    ).toThrow(/não existe/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Fundo por token — o comportamento que veio do medidor de 124 (`fundoEfetivo`)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('fundo declarado por token', () => {
  it('usa o `bg-*` do ancestral mais próximo, não o do avô', () => {
    // Era o teste de `fundoEfetivo` no medidor de 124; aqui a cadeia é percorrida pela
    // varredura, que é quem de fato decide o fundo das telas.
    const { medidas } = medir(
      '<div class="bg-background"><div class="bg-card"><p class="text-foreground/70">x</p></div></div>',
    )
    expect(medidas).toHaveLength(1)
    expect(medidas[0].fundo).toBe(TOKENS['--color-card'])
  })

  it('cai no fundo padrão do `body` quando nenhum ancestral pinta fundo', () => {
    const { medidas } = medir('<div><p class="text-foreground/70">x</p></div>')
    expect(medidas[0].fundo).toBe(TOKENS['--color-background'])
  })

  it('LANÇA em `bg-*` sem token nem utilitário de imagem — nunca ignora o fundo', () => {
    expect(() => fundoDoElemento('bg-cinzinha', TEMA, '#ffffff')).toThrow(
      /não corresponde a nenhum token/,
    )
  })

  it('`bg-transparent` não pinta — o fundo continua sendo o do ancestral', () => {
    expect(fundoDoElemento('bg-transparent', TEMA, '#ffffff')).toEqual({
      tipo: 'cores',
      hexes: ['#ffffff'],
    })
  })
})

describe('fundo com opacidade — bg-border/50', () => {
  it('compõe o fundo do badge; /60 reprova e /70 passa SOBRE ELE', () => {
    // Sem compor o `bg-border/50`, o texto seria medido contra o card branco (4,04 × 5,47) —
    // otimista por engano. O fundo real é mais escuro, e os dois números caem.
    const ruim = medir(
      '<div class="bg-card"><span class="bg-border/50 text-foreground/60">Em breve</span></div>',
    )
    const bom = medir(
      '<div class="bg-card"><span class="bg-border/50 text-foreground/70">Em breve</span></div>',
    )

    expect(fundoDoElemento('bg-border/50', TEMA, TOKENS['--color-card'])).toEqual({
      tipo: 'cores',
      hexes: [ruim.medidas[0].fundo],
    })
    expect(ruim.medidas[0].razao.toFixed(2)).toBe('3.72')
    expect(reprovacoesAA(ruim.medidas)).toHaveLength(1)

    expect(bom.medidas[0].razao.toFixed(2)).toBe('4.92')
    expect(reprovacoesAA(bom.medidas)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Herança de cor — o caso que o medidor de 124 não via
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('herança de cor', () => {
  it('mede o texto do FILHO com a cor declarada no PAI, e marca como herdada', () => {
    // É o `Breadcrumb`: a cor está no <nav>, o texto está nos <span>/<a>.
    const { medidas } = medir(
      '<nav class="text-xs text-foreground/60"><span><a>Administração</a></span></nav>',
    )
    const doLink = medidas.filter((m) => m.texto === 'Administração')

    expect(doLink).toHaveLength(1)
    expect(doLink[0].herdada).toBe(true)
    expect(doLink[0].classe).toBe('text-foreground/60')
    expect(doLink[0].razao.toFixed(2)).toBe('3.88') // sobre a página, reprova
  })

  it('a cor PRÓPRIA vence a herdada, e não é marcada como herdada', () => {
    const { medidas } = medir(
      '<nav class="text-foreground/60"><span class="text-foreground/80">Atual</span></nav>',
    )
    const doSpan = medidas.filter((m) => m.texto === 'Atual')

    expect(doSpan).toHaveLength(1)
    expect(doSpan[0].herdada).toBe(false)
    expect(doSpan[0].classe).toBe('text-foreground/80')
  })

  it('sem nenhuma classe de cor na cadeia, vale a cor do body — e ela PASSA', () => {
    const { medidas } = medir('<p>texto sem classe</p>')

    expect(medidas).toHaveLength(1)
    expect(medidas[0].classe).toBe(CLASSE_DO_BODY)
    expect(medidas[0].razao).toBeGreaterThan(PISO_AA)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Grupo `opacity-*`
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('grupo opacity-* — o card cancelado', () => {
  it('/70 dentro de opacity-70 REPROVA, e o token cheio passa', () => {
    // O grupo compõe fundo + texto sobre a página: a opacidade da classe se soma à do grupo.
    const comOpacidade = medir(
      '<article class="bg-card opacity-70"><p class="text-foreground/70">08:00 → 09:00 · sem pausa</p></article>',
    )
    const cheio = medir(
      '<article class="bg-card opacity-70"><p class="text-foreground">08:00 → 09:00 · sem pausa</p></article>',
    )

    expect(comOpacidade.medidas[0].razao.toFixed(2)).toBe('3.00')
    expect(reprovacoesAA(comOpacidade.medidas)).toHaveLength(1)

    expect(cheio.medidas[0].razao.toFixed(2)).toBe('5.59')
    expect(reprovacoesAA(cheio.medidas)).toEqual([])
  })

  it('sem o grupo, o MESMO /70 passa — é a opacidade do ancestral que vira o veredito', () => {
    const semGrupo = medir('<article class="bg-card"><p class="text-foreground/70">x</p></article>')
    expect(semGrupo.medidas[0].razao.toFixed(2)).toBe('5.47')
  })

  it('opacidadeDoElemento lê o fator, e 1 quando não há a classe', () => {
    expect(opacidadeDoElemento('rounded-card bg-card p-4 opacity-70')).toBe(0.7)
    expect(opacidadeDoElemento('rounded-card bg-card p-4')).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Q-3 — GRADIENTE: modelado por PARADA, com veredito do pior ponto
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('Q-3 · fundo em gradiente — derivado do CSS, medido no PIOR ponto', () => {
  it('o mapa `bg-<x>` -> `background-image` é DERIVADO dos `@utility` da cascata', () => {
    // Nenhuma lista escrita à mão: um gradiente novo no design system entra na varredura
    // sozinho. `rules/security.md` § "enumeração que dá poder a um invariante".
    expect(Object.keys(TEMA.fundosDeImagem).sort()).toEqual([
      'bg-grad-card-fill',
      'bg-grad-escuro',
      'bg-grad-secao',
    ])
    expect(TEMA.fundosDeImagem['bg-grad-escuro']).toMatch(/^linear-gradient\(/)
  })

  it('ignora `@utility` que aparece dentro de COMENTÁRIO — comentário não é declaração', () => {
    const css = `
      /* exemplo da documentação:
         @utility bg-grad-fantasma { background-image: var(--grad-fantasma); } */
      @utility bg-grad-real { background-image: var(--grad-real); }
    `
    expect(utilitariosDeImagemDoCss(css)).toEqual({ 'bg-grad-real': '--grad-real' })
  })

  it('o utilitário e o valor do gradiente vivem em ARQUIVOS diferentes da cascata', () => {
    // `@utility bg-grad-escuro` está em `styles.css` e `--grad-escuro:` em `tokens.css`.
    // Resolver por arquivo devolveria `var(--grad-escuro)` cru, o parser recusaria, e a
    // sidebar voltaria a não ser medida — em silêncio, com `pulados` "justificado".
    const porArquivo = CASCATA_CSS.map((arquivo) => ({
      utilitarios: Object.keys(utilitariosDeImagemDoCss(lerDoDisco(arquivo))),
      temGradEscuro: customPropertiesDoCss(lerDoDisco(arquivo))['--grad-escuro'] !== undefined,
    }))
    const declaraUtilitario = porArquivo.filter((a) => a.utilitarios.includes('bg-grad-escuro'))
    const declaraValor = porArquivo.filter((a) => a.temGradEscuro)

    expect(declaraUtilitario).toHaveLength(1)
    expect(declaraValor).toHaveLength(1)
    expect(declaraUtilitario[0]).not.toBe(declaraValor[0])
  })

  it('extrai as paradas do gradiente REAL da sidebar (as duas pontas)', () => {
    expect(paradasDeGradiente(TEMA.fundosDeImagem['bg-grad-escuro'])).toEqual({
      tipo: 'cores',
      hexes: ['#074b7f', '#002f4f'],
    })
  })

  it('aceita direção por palavra (`to right`) e normaliza hex de 3 dígitos', () => {
    expect(paradasDeGradiente('linear-gradient(to right, #fff 0%, #002f4f 100%)')).toEqual({
      tipo: 'cores',
      hexes: ['#ffffff', '#002f4f'],
    })
  })

  it('mede o texto da sidebar CONTRA AS DUAS PONTAS — `/60` reprova na clara', () => {
    // O veredito é o do PIOR ponto: medir só a ponta escura devolveria "passa" para um
    // texto que reprova em metade da barra. Este é o defeito `Q-3` inteiro.
    const { medidas, pulados } = medir(
      '<nav class="bg-grad-escuro"><span class="text-white/60">Dashboards</span></nav>',
    )

    expect(pulados).toEqual([])
    expect(medidas.map((m) => m.fundo).sort()).toEqual(['#002f4f', '#074b7f'])
    expect(medidas.map((m) => m.razao.toFixed(2)).sort()).toEqual(['4.33', '5.89'])
    expect(razaoDoTexto(medidas, 'Dashboards').toFixed(2)).toBe('4.33')
    expect(razaoDaClasse(medidas, 'text-white/60')?.toFixed(2)).toBe('4.33')
    expect(reprovacoesAA(medidas)).toHaveLength(1)
  })

  it('COMPANHEIRA POSITIVA: `/70`, o valor corrigido, passa nas DUAS pontas', () => {
    const { medidas, pulados } = medir(
      '<nav class="bg-grad-escuro"><span class="text-white/70">Dashboards</span></nav>',
    )

    expect(pulados).toEqual([])
    expect(medidas.map((m) => m.razao.toFixed(2)).sort()).toEqual(['5.31', '7.50'])
    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Q-3 — RECUSA: o que o medidor não modela vai para `pulados`, nunca para o fallback
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('Q-3 · recusa — nada vira fallback silencioso', () => {
  /**
   * Cada caso abaixo é construído para que o FALLBACK (medir contra o fundo da página)
   * devolvesse **um número que passa**. Sem a recusa, `pulados` sairia vazio, `medidas`
   * traria a medição errada e `reprovacoesAA` diria "está tudo certo" — que é exatamente
   * o defeito `Q-3`. Por isso a asserção é sobre `pulados`, não sobre a razão.
   */

  it('`style="background-color"` inline é RECUSADO (o fallback aprovaria a 5,20:1)', () => {
    const { medidas, pulados } = medir(
      '<div style="background-color: #3d5566"><p class="text-foreground/70">rótulo</p></div>',
    )

    expect(medidas).toEqual([])
    expect(pulados).toHaveLength(1)
    expect(pulados[0].texto).toBe('rótulo')
    expect(pulados[0].motivo).toMatch(/atributo `style`/)
  })

  it('`style="color"` inline é RECUSADO — a cor também não é derivável', () => {
    // `LineChartMovimentacao` faz isto no tooltip: `style={{ color: p.color }}`.
    const { medidas, pulados } = medir(
      '<div class="bg-card"><p style="color: #cccccc">Movimentação: 12</p></div>',
    )

    expect(medidas).toEqual([])
    expect(pulados[0].motivo).toMatch(/color: #cccccc/)
  })

  it('COMPANHEIRA POSITIVA: o irmão SEM style continua sendo medido na mesma árvore', () => {
    // Sem esta metade, a recusa poderia estar engolindo a árvore inteira e `reprovacoesAA`
    // ficaria vazio por não ter medido nada — indistinguível de "passou".
    const { medidas, pulados } = medir(
      '<div class="bg-card">' +
        '<p style="background-color: #3d5566">com style</p>' +
        '<p class="text-foreground/70">sem style</p>' +
        '</div>',
    )

    expect(pulados.map((p) => p.texto)).toEqual(['com style'])
    expect(medidas.map((m) => m.texto)).toEqual(['sem style'])
    expect(medidas[0].razao.toFixed(2)).toBe('5.47')
  })

  it('`style` que NÃO pinta (posição, tamanho) não recusa nada', () => {
    // Precisão, nunca frouxidão: `InfoIcon` põe `style={{ left, top }}` no tooltip em
    // portal. Recusar ali cegaria a varredura de um primitivo inteiro.
    const { medidas, pulados } = medir(
      '<div class="bg-card"><p style="left: 12px; top: 4px" class="text-foreground/70">dica</p></div>',
    )

    expect(pulados).toEqual([])
    expect(medidas.map((m) => m.texto)).toEqual(['dica'])
  })

  it('`background: transparent` inline também não recusa — não pinta', () => {
    expect(
      declaracaoInlineNaoModelavel(alvoDe('<p id="alvo" style="background: transparent">x</p>')),
    ).toBeNull()
    expect(
      declaracaoInlineNaoModelavel(alvoDe('<p id="alvo" style="background-color: #123456">x</p>')),
    ).toMatch(/RECUSA/)
  })

  it('classe de fundo com valor ARBITRÁRIO (`bg-[…]`) é RECUSADA', () => {
    // A regex de `bg-<token>` nem casa com `bg-[#3d5566]`: antes, o fundo simplesmente
    // não existia para o medidor e o texto era medido contra a página.
    const { medidas, pulados } = medir(
      '<div class="bg-[#3d5566]"><p class="text-foreground/70">rótulo</p></div>',
    )

    expect(medidas).toEqual([])
    expect(pulados[0].motivo).toMatch(/valor arbitrário/)
  })

  it('gradiente com parada NÃO-hexadecimal é RECUSADO, nomeando a parada', () => {
    // `--grad-card-fill` do design system usa `rgba(...)`: parada com alfa próprio exigiria
    // simular a pilha de pintura inteira. O medidor recusa em vez de adivinhar.
    const recusa = paradasDeGradiente(TEMA.fundosDeImagem['bg-grad-card-fill'])
    expect(recusa.tipo).toBe('recusa')

    const { medidas, pulados } = medir(
      '<div class="bg-grad-card-fill"><p class="text-foreground/70">rótulo</p></div>',
    )
    expect(medidas).toEqual([])
    expect(pulados[0].motivo).toMatch(/rgba/)
  })

  it('`url(...)` e `var(...)` como fundo de imagem também são RECUSADOS', () => {
    expect(paradasDeGradiente('url("/fundo.png")')).toMatchObject({ tipo: 'recusa' })
    expect(paradasDeGradiente('var(--grad-que-nao-resolveu)')).toMatchObject({ tipo: 'recusa' })
    expect(paradasDeGradiente('linear-gradient(90deg, var(--x) 0%, #002f4f 100%)')).toMatchObject({
      tipo: 'recusa',
    })
  })

  it('registra elemento com texto próprio cujo className não é string (SVG)', () => {
    const raiz = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const texto = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    texto.textContent = 'rótulo dentro do SVG'
    svg.appendChild(texto)
    raiz.appendChild(svg)

    const { medidas, pulados } = medirTextosComHeranca(raiz, { tema: TEMA, padroes: PADROES })

    expect(medidas).toEqual([])
    expect(pulados).toHaveLength(1)
    expect(pulados[0].motivo).toMatch(/não é string/)
  })

  it('não pula nada num fragmento HTML comum — o campo não é uma lixeira', () => {
    const { pulados } = medir('<div class="bg-card"><p class="text-foreground/70">x</p></div>')
    expect(pulados).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Q-125-1 — a recusa tem DUAS pontas: a cor do TEXTO e a OPACIDADE (125/FE-A11Y-5)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('Q-125-1 · recusa na ponta do TEXTO — o numerador da razão', () => {
  /**
   * Cada caso abaixo era, até 125/FE-A11Y-5, um **fallback silencioso do numerador**: a
   * classe não casava regex nenhuma, o elemento caía na cor herdada e o medidor devolvia,
   * com confiança, o contraste de **outro** elemento. Por isso toda asserção vem em par:
   * a recusa **e** o número que o fallback teria devolvido, medido na mesma execução com
   * a classe removida. Sem o segundo, "recusou" seria indistinguível de "a árvore inteira
   * parou de ser medida".
   */

  it('`text-[#hex]` é RECUSADO — o fallback devolveria 13,82:1 (a cor do body)', () => {
    const comArbitraria = medir(
      '<div class="bg-card"><p class="text-base text-[#b3c1ca]">mensagem</p></div>',
    )
    const semClasseNenhuma = medir('<div class="bg-card"><p class="text-base">mensagem</p></div>')

    expect(comArbitraria.medidas).toEqual([])
    expect(comArbitraria.pulados).toHaveLength(1)
    expect(comArbitraria.pulados[0].texto).toBe('mensagem')
    expect(comArbitraria.pulados[0].motivo).toMatch(/valor arbitrário "text-\[#b3c1ca\]"/)

    // O número que a recusa substituiu: o fallback aprovava a 13,82:1 um texto que a tela
    // mostra a 1,84:1. É a face `a` do quinto ponto cego, inteira.
    expect(semClasseNenhuma.medidas[0].classe).toBe(CLASSE_DO_BODY)
    expect(semClasseNenhuma.medidas[0].razao.toFixed(2)).toBe('13.82')
    expect(comAlfa(TOKENS['--color-primary'], TOKENS['--color-card'], 0.3)).toBe('#b3c1ca')
  })

  it('`text-[#hex]` recusa MESMO com uma classe de cor modelável ao lado', () => {
    // Quem desempata classe de cor conflitante é a folha gerada, não o componente (ponto
    // cego nº 5 da 125). Com uma das duas não modelável, o vencedor é indecidível.
    const { medidas, pulados } = medir(
      '<div class="bg-card"><p class="text-foreground text-[#b3c1ca]">mensagem</p></div>',
    )
    expect(medidas).toEqual([])
    expect(pulados).toHaveLength(1)
  })

  it('COMPANHEIRA POSITIVA: `text-[16px]` é TAMANHO e continua sendo ignorado', () => {
    // Precisão, nunca frouxidão: há 33 `text-[NNpx]` nesta árvore. Recusar por prefixo
    // (`text-[`) tiraria 33 pontos de texto da varredura para pegar zero defeitos.
    const { medidas, pulados } = medir(
      '<div class="bg-card"><p class="text-[16px] text-foreground/70">frase</p></div>',
    )
    expect(pulados).toEqual([])
    expect(medidas.map((m) => m.classe)).toEqual(['text-foreground/70'])
    expect(medidas[0].razao.toFixed(2)).toBe('5.47')
  })

  it.each([
    ['text-[16px]', false],
    ['text-[0.75rem]', false],
    ['text-[calc(1rem+2px)]', false],
    ['text-[length:var(--x)]', false],
    ['text-[#b3c1ca]', true],
    ['text-[var(--color-primary)]', true],
    ['text-[color:var(--x)]', true],
    ['text-[rgb(1,2,3)]', true],
    ['text-[oklch(0.7_0.1_20)]', true],
  ])('%s -> recusa? %s (o TIPO do valor decide, não o formato da classe)', (classe, recusa) => {
    expect(classeDeTextoNaoModelavel(classe, TEMA) !== null).toBe(recusa)
  })

  it('`text-<token>/[0.3]` (opacidade arbitrária) é RECUSADO — a regex de /NN não a casa', () => {
    const arbitraria = medir(
      '<div class="bg-card"><p class="text-foreground/[0.3]">mensagem</p></div>',
    )
    const equivalente = medir('<div class="bg-card"><p class="text-foreground/30">mensagem</p></div>')

    expect(arbitraria.medidas).toEqual([])
    expect(arbitraria.pulados[0].motivo).toMatch(/notação arbitrária/)
    // O mesmo valor escrito em `/NN` é modelado e REPROVA. A recusa cobre exatamente o
    // buraco entre as duas notações — a face `b`.
    expect(equivalente.pulados).toEqual([])
    expect(equivalente.medidas[0].razao.toFixed(2)).toBe('1.84')
    expect(reprovacoesAA(equivalente.medidas)).toHaveLength(1)
  })

  it('COMPANHEIRA POSITIVA: `/[1.5]` sobre token de TAMANHO é altura de linha, não opacidade', () => {
    expect(TEMA.tamanhosDeTexto.has('card')).toBe(true)
    expect(classeDeTextoNaoModelavel('text-card/[1.5] font-medium', TEMA)).toBeNull()
  })

  it('a cor não modelável declarada num ANCESTRAL também recusa, e diz que é herdada', () => {
    const { medidas, pulados } = medir(
      '<div class="bg-card"><nav class="text-[#b3c1ca]"><span>Administração</span></nav></div>',
    )
    expect(medidas).toEqual([])
    expect(pulados.map((p) => p.texto)).toEqual(['Administração'])
    expect(pulados[0].motivo).toMatch(/ancestral do texto/)
  })
})

describe('Q-125-1 · recusa de OPACIDADE inline — o grupo que não estava na lista', () => {
  it('`style="opacity"` é RECUSADO, e o fallback teria medido 5,47:1 na mesma árvore', () => {
    // A mutação do QA: `style={{opacity: 0.15}}` na mensagem do `EmptyState` deixou a suíte
    // inteira verde com a frase a ~1,6:1 na tela.
    const comOpacidade = medir(
      '<div class="bg-card"><p class="text-foreground/70" style="opacity: 0.15">mensagem</p></div>',
    )
    const semOpacidade = medir(
      '<div class="bg-card"><p class="text-foreground/70">mensagem</p></div>',
    )

    expect(comOpacidade.medidas).toEqual([])
    expect(comOpacidade.pulados[0].motivo).toMatch(/opacity: 0\.15/)
    expect(semOpacidade.pulados).toEqual([])
    expect(semOpacidade.medidas[0].razao.toFixed(2)).toBe('5.47')
  })

  it('opacidade inline num ANCESTRAL também recusa — é um grupo, como `opacity-NN`', () => {
    const { medidas, pulados } = medir(
      '<article class="bg-card" style="opacity: 0.7"><p class="text-foreground">08:00 → 09:00</p></article>',
    )
    expect(medidas).toEqual([])
    expect(pulados).toHaveLength(1)
  })

  it('COMPANHEIRA POSITIVA: `opacity: 1` NÃO recusa — não compõe nada', () => {
    const { medidas, pulados } = medir(
      '<div class="bg-card"><p class="text-foreground/70" style="opacity: 1">frase</p></div>',
    )
    expect(pulados).toEqual([])
    expect(medidas[0].razao.toFixed(2)).toBe('5.47')
  })

  it.each([
    ['opacity: 0.15', true],
    ['opacity: 1', false],
    ['opacity: 1.0', false],
    ['opacity: 100%', false],
    ['left: 12px; top: 4px', false],
    ['cursor: pointer', false],
    ['width: 140px', false],
  ])('style="%s" -> recusa? %s', (estilo, recusa) => {
    expect(declaracaoInlineNaoModelavel(alvoDe(`<p id="alvo" style="${estilo}">x</p>`)) !== null)
      .toBe(recusa)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Q-125-4 — gradiente NATIVO do Tailwind: recusa, nunca lança
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('Q-125-4 · `bg-linear-to-r` / `bg-gradient-to-r` — classe legítima, recusa', () => {
  it.each([
    'bg-linear-to-r',
    'bg-linear-to-br',
    'bg-linear-45',
    'bg-gradient-to-r',
    'bg-gradient-to-tl',
    'bg-radial',
    'bg-conic',
    'bg-conic-180',
  ])('%s RECUSA em vez de LANÇAR (lançar tira a tela inteira da varredura)', (classe) => {
    // Foi lançando que a `Sidebar` ficou quatro unidades sem ser medida por ninguém: a
    // exceção sobe, o teste da tela morre inteiro, e o texto some da varredura do mesmo
    // jeito que sumiria num fallback silencioso.
    expect(() => fundoDoElemento(classe, TEMA, '#ffffff')).not.toThrow()
    expect(fundoDoElemento(classe, TEMA, '#ffffff')).toMatchObject({ tipo: 'recusa' })

    const { medidas, pulados } = medir(
      `<div class="${classe} from-primary to-card"><p class="text-white">Dashboards</p></div>`,
    )
    expect(medidas).toEqual([])
    expect(pulados[0].motivo).toMatch(/gradiente nativo do Tailwind/)
  })

  it('COMPANHEIRA POSITIVA: `bg-inexistente` continua LANÇANDO — classe errada nunca passa', () => {
    // Sem esta metade, a recusa nova poderia ter engolido também o token faltando, e a
    // trava que existe para pegar classe errada morreria em silêncio.
    expect(() => fundoDoElemento('bg-inexistente', TEMA, '#ffffff')).toThrow(
      /não corresponde a nenhum token/,
    )
    expect(() => fundoDoElemento('bg-linear', TEMA, '#ffffff')).toThrow(
      /não corresponde a nenhum token/,
    )
  })

  it('`bg-<x>-[…]` (arbitrário com prefixo, v4) também é RECUSADO, não ignorado', () => {
    expect(fundoDoElemento('bg-radial-[at_50%_50%]', TEMA, '#ffffff')).toMatchObject({
      tipo: 'recusa',
    })
    expect(fundoDoElemento('bg-linear-[45deg]', TEMA, '#ffffff')).toMatchObject({
      tipo: 'recusa',
    })
  })

  it('o gradiente MODELADO do design system continua sendo medido — a recusa não vazou', () => {
    const { medidas, pulados } = medir(
      '<nav class="bg-grad-escuro"><span class="text-white/70">Dashboards</span></nav>',
    )
    expect(pulados).toEqual([])
    expect(medidas.map((m) => m.razao.toFixed(2)).sort()).toEqual(['5.31', '7.50'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Controle positivo do conjunto — reprova o ruim e aprova o bom na MESMA execução
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('controle positivo do conjunto', () => {
  it('reprova os tokens que o QA mediu reprovados (D-2 e D-3 da 124)', () => {
    // Se o medidor morresse (0 medições, cor cheia em vez de composta, fundo errado),
    // este teste ficaria verde ao contrário — ele exige VERMELHO nestes três.
    const { medidas, pulados } = medir(`
      <div class="bg-card">
        <p class="text-xs italic text-primary/30">mensagem do EmptyState compartilhado</p>
        <p class="text-sm text-foreground/50">dica de campo</p>
        <p class="text-xs text-foreground/60">clientes afetados</p>
      </div>
    `)

    expect(pulados).toEqual([])
    expect(razaoDaClasse(medidas, 'text-primary/30')?.toFixed(2)).toBe('1.84')
    expect(razaoDaClasse(medidas, 'text-foreground/50')?.toFixed(2)).toBe('3.04')
    expect(razaoDaClasse(medidas, 'text-foreground/60')?.toFixed(2)).toBe('4.04')
    expect(reprovacoesAA(medidas)).toHaveLength(3)
  })

  it('os mesmos tokens sobre a PÁGINA — piores ainda; /70 passa nos dois fundos', () => {
    const sobrePagina = medir(`
      <div>
        <p class="text-foreground/50">parágrafo da tela</p>
        <p class="text-foreground/60">rótulo do KPI</p>
        <p class="text-foreground/70">parágrafo corrigido</p>
      </div>
    `)

    expect(razaoDaClasse(sobrePagina.medidas, 'text-foreground/50')?.toFixed(2)).toBe('2.95')
    expect(razaoDaClasse(sobrePagina.medidas, 'text-foreground/60')?.toFixed(2)).toBe('3.88')
    expect(razaoDaClasse(sobrePagina.medidas, 'text-foreground/70')?.toFixed(2)).toBe('5.20')
    expect(reprovacoesAA(sobrePagina.medidas)).toHaveLength(2)

    const sobreCard = medir('<div class="bg-card"><p class="text-foreground/70">x</p></div>')
    expect(sobreCard.medidas[0].razao.toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(sobreCard.medidas)).toEqual([])
  })

  it('o fundo MUDA o veredito: /65 passa sobre o card e REPROVA sobre a página', () => {
    // É por isso que o fundo é derivado da árvore, e não fixado no teste. `/65` não é usado
    // em lugar nenhum: está aqui porque é onde a fronteira AA cai entre os dois fundos do
    // app — com o fundo presumido, o veredito de um token nessa faixa seria simplesmente
    // errado.
    const noCard = (classe: string) =>
      medir(`<div class="bg-card"><p class="${classe}">x</p></div>`).medidas[0].razao
    const naPagina = (classe: string) => medir(`<p class="${classe}">x</p>`).medidas[0].razao

    expect(noCard('text-foreground/65')).toBeGreaterThanOrEqual(PISO_AA)
    expect(naPagina('text-foreground/65')).toBeLessThan(PISO_AA)
    expect(noCard('text-foreground/60').toFixed(2)).toBe('4.04')
    expect(naPagina('text-foreground/60').toFixed(2)).toBe('3.88')
  })

  it('ignora ícone decorativo sem texto próprio, mede o parágrafo com texto', () => {
    const { medidas } = medir(
      '<div class="bg-card"><span class="text-border" aria-hidden="true"><svg></svg></span><p class="text-foreground/70">frase</p></div>',
    )

    expect(medidas.map((m) => m.classe)).toEqual(['text-foreground/70'])
  })

  it('pula texto DECORATIVO (aria-hidden) e continua pegando o irmão de conteúdo', () => {
    // O par é obrigatório: sem o irmão que REPROVA, a regra de `aria-hidden` poderia estar
    // engolindo a árvore inteira e o teste ficaria verde do mesmo jeito.
    const { medidas } = medir(`
      <div>
        <span aria-hidden="true" class="text-foreground/40">•</span>
        <span class="text-foreground/40">texto de verdade</span>
      </div>
    `)

    expect(medidas.map((m) => m.texto)).toEqual(['texto de verdade'])
    expect(reprovacoesAA(medidas)).toHaveLength(1)
  })

  it('comAlfa compõe sobre o fundo — 100% devolve a própria cor', () => {
    expect(comAlfa('#002f4f', '#ffffff', 1)).toBe('#002f4f')
    expect(comAlfa('#002f4f', '#ffffff', 0)).toBe('#ffffff')
    expect(PISO_AA).toBe(4.5)
  })
})
