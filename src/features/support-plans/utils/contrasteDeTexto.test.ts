import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { derivarCascataDeCssDoApp, lerTokensDeCor } from '../../../utils/cssCascade'
import {
  PISO_AA,
  comAlfa,
  coresDeTextoDaClasse,
  fundoEfetivo,
  medirTextosDoDom,
  reprovacoesAA,
  temaDaCascata,
} from './contrasteDeTexto'

/**
 * 124/FE-FIX2 — testes do MEDIDOR. Sem eles, um "0 reprovações" nas telas seria
 * indistinguível de um medidor quebrado que aprova qualquer coisa.
 *
 * Os hexes vêm da cascata real de CSS (`cssCascade`), nunca espelhados aqui.
 */

const lerDoDisco = (caminho: string): string => readFileSync(resolve(process.cwd(), caminho), 'utf8')
const CASCATA_CSS = derivarCascataDeCssDoApp(lerDoDisco)
const TOKENS = lerTokensDeCor(CASCATA_CSS, lerDoDisco)
const TEMA = temaDaCascata(CASCATA_CSS, lerDoDisco, TOKENS)

function elementoCom(html: string): HTMLElement {
  const raiz = document.createElement('div')
  raiz.innerHTML = html
  return raiz
}

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
    // Achado real desta unidade: `--text-card: 16px` e `--color-card: #ffffff` coexistem, e
    // o `<h2 class="text-card font-medium text-primary">` do `Modal` era medido como
    // "branco sobre branco = 1,00:1". Quem desambigua é o CSS, não uma lista.
    expect(TEMA.tamanhosDeTexto.has('card')).toBe(true)
    expect(coresDeTextoDaClasse('text-card font-medium text-primary', TEMA)).toEqual([
      { classe: 'text-primary', token: '--color-primary', alfa: 1 },
    ])
  })

  it('LANÇA quando a classe tem opacidade e o token não existe — nunca ignora', () => {
    expect(() => coresDeTextoDaClasse('text-forground/70', TEMA)).toThrow(
      /não existe na cascata/,
    )
  })
})

describe('fundoEfetivo', () => {
  it('usa o `bg-*` do ancestral mais próximo, não o do avô', () => {
    const raiz = elementoCom(
      '<div class="bg-background"><div class="bg-card"><p id="alvo" class="text-foreground/70">x</p></div></div>',
    )
    const alvo = raiz.querySelector('#alvo')
    expect(alvo).not.toBeNull()
    expect(fundoEfetivo(alvo as Element, TOKENS, TOKENS['--color-background'])).toBe(
      TOKENS['--color-card'],
    )
  })

  it('cai no fundo padrão quando nenhum ancestral pinta fundo', () => {
    const raiz = elementoCom('<div><p id="alvo" class="text-foreground/70">x</p></div>')
    expect(fundoEfetivo(raiz.querySelector('#alvo') as Element, TOKENS, '#f0f4f7')).toBe('#f0f4f7')
  })

  it('LANÇA em classe de fundo sem token correspondente', () => {
    const raiz = elementoCom('<div class="bg-cinzinha"><p id="alvo" class="text-foreground/70">x</p></div>')
    expect(() =>
      fundoEfetivo(raiz.querySelector('#alvo') as Element, TOKENS, '#ffffff'),
    ).toThrow(/não corresponde a nenhum token/)
  })
})

describe('medirTextosDoDom — CONTROLE POSITIVO do medidor', () => {
  const card = TOKENS['--color-card']
  const pagina = TOKENS['--color-background']

  it('reprova os tokens que o QA mediu reprovados (D-2 e D-3)', () => {
    // Se o medidor morresse (0 medições, cor cheia em vez de composta, fundo errado),
    // este teste ficaria verde ao contrário — ele exige VERMELHO nestes três.
    const raiz = elementoCom(`
      <div class="bg-card">
        <p class="text-xs italic text-primary/30">mensagem do EmptyState compartilhado</p>
        <p class="text-sm text-foreground/50">dica de campo</p>
        <p class="text-xs text-foreground/60">clientes afetados</p>
      </div>
    `)

    const medidas = medirTextosDoDom(raiz, { tema: TEMA, fundoPadrao: pagina })
    const porClasse = new Map(medidas.map((medida) => [medida.classe, medida.razao]))

    expect(porClasse.get('text-primary/30')?.toFixed(2)).toBe('1.84')
    expect(porClasse.get('text-foreground/50')?.toFixed(2)).toBe('3.04')
    expect(porClasse.get('text-foreground/60')?.toFixed(2)).toBe('4.04')
    expect(reprovacoesAA(medidas)).toHaveLength(3)
  })

  it('aprova o que a correção passou a usar — /70 sobre card e sobre a página', () => {
    const sobreCard = medirTextosDoDom(
      elementoCom('<div class="bg-card"><p class="text-foreground/70">x</p></div>'),
      { tema: TEMA, fundoPadrao: pagina },
    )
    const sobrePagina = medirTextosDoDom(elementoCom('<p class="text-foreground/70">x</p>'), {
      tema: TEMA,
      fundoPadrao: pagina,
    })

    expect(sobreCard[0].razao.toFixed(2)).toBe('5.47')
    expect(sobrePagina[0].razao.toFixed(2)).toBe('5.20')
    expect(reprovacoesAA([...sobreCard, ...sobrePagina])).toEqual([])
  })

  it('o fundo MUDA o veredito: /65 passa sobre o card e REPROVA sobre a página', () => {
    // É por isso que o fundo é derivado da árvore, e não fixado no teste. `/65` não é usado
    // em lugar nenhum: está aqui porque é onde a fronteira AA cai entre os dois fundos do
    // app — com o fundo presumido, o veredito de um token nessa faixa seria simplesmente
    // errado. Os `/60` abaixo são o par de referência: reprovam nos DOIS fundos.
    expect(contraste('text-foreground/65', card)).toBeGreaterThanOrEqual(4.5)
    expect(contraste('text-foreground/65', pagina)).toBeLessThan(4.5)

    expect(contraste('text-foreground/60', card).toFixed(2)).toBe('4.04')
    expect(contraste('text-foreground/60', pagina).toFixed(2)).toBe('3.88')

    function contraste(classe: string, fundo: string): number {
      const medidas = medirTextosDoDom(elementoCom(`<p class="${classe}">x</p>`), {
        tema: TEMA,
        fundoPadrao: fundo,
      })
      return medidas[0].razao
    }
  })

  it('ignora ícone decorativo sem texto próprio, mede o parágrafo com texto', () => {
    const raiz = elementoCom(
      '<div class="bg-card"><span class="text-border" aria-hidden="true"><svg></svg></span><p class="text-foreground/70">frase</p></div>',
    )
    const medidas = medirTextosDoDom(raiz, { tema: TEMA, fundoPadrao: pagina })

    expect(medidas.map((medida) => medida.classe)).toEqual(['text-foreground/70'])
  })

  it('pula texto DECORATIVO (aria-hidden) e continua pegando o irmão de conteúdo', () => {
    // O par é obrigatório: sem o irmão que REPROVA, a regra de `aria-hidden` poderia estar
    // engolindo a árvore inteira e o teste ficaria verde do mesmo jeito.
    const raiz = elementoCom(`
      <div>
        <span aria-hidden="true" class="text-foreground/40">•</span>
        <span class="text-foreground/40">texto de verdade</span>
      </div>
    `)
    const medidas = medirTextosDoDom(raiz, { tema: TEMA, fundoPadrao: pagina })

    expect(medidas.map((medida) => medida.texto)).toEqual(['texto de verdade'])
    expect(reprovacoesAA(medidas)).toHaveLength(1)
  })

  it('comAlfa compõe sobre o fundo — 100% devolve a própria cor', () => {
    expect(comAlfa('#002f4f', '#ffffff', 1)).toBe('#002f4f')
    expect(comAlfa('#002f4f', '#ffffff', 0)).toBe('#ffffff')
    expect(PISO_AA).toBe(4.5)
  })
})
