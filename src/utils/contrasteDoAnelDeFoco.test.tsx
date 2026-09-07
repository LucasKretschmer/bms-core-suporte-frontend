/**
 * 126/FE-FOCO — **a trava que impede o anel de foco de voltar a ser invisível.**
 *
 * O achado `Q-125-5` do QA da demanda 125: `:focus-visible { outline: 2px solid
 * var(--color-primary) }` media **1,53:1 na ponta clara do gradiente da `Sidebar` e 1,00:1
 * na escura**. O anel existia no CSS e não existia na tela.
 *
 * ## O que este arquivo prova, e em que ordem
 *
 * 1. **O anel medido é o anel do CSS.** `ANEL` é derivado da regra `:focus-visible` da
 *    cascata real (`test/medidor-de-contraste.ts`), nunca digitado aqui. Nenhuma asserção
 *    olha para um hex escrito à mão do lado do valor esperado; os hexes literais que
 *    aparecem são os **históricos** (o anel de antes) e os do **controle positivo**.
 * 2. **O medidor REPROVA o anel de antes, na mesma execução.** Sem essa metade, "nenhuma
 *    reprovação" seria indistinguível de um medidor que parou de medir. Os números do
 *    controle positivo são exatamente os que o QA relatou: 1,53 e 1,00.
 * 3. **O anel de agora passa sobre QUALQUER fundo — provado, não amostrado.** A varredura
 *    percorre a faixa inteira de luminância relativa (0 a 1), que nenhuma cor sRGB pode
 *    deixar. É o que dispensa manter uma lista de superfícies à mão — lista mantida à mão
 *    nasce incompleta e envelhece (`rules/security.md`).
 * 4. **E passa sobre os fundos que a app de fato tem**, com a lista **derivada da cascata
 *    de CSS**: todo token `--color-*` mais toda parada de todo gradiente `@utility`.
 * 5. **E passa nas árvores renderizadas de verdade**, com `pulados` asserido vazio: um
 *    fundo que o medidor não saiba modelar reprova, nunca some.
 *
 * A `Sidebar` — o componente do achado — é medida no arquivo dela
 * (`components/layout/Sidebar.test.tsx`), onde o mock de `Link` do router já existe e
 * encaminha `className`/`activeProps`.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './colorContrast'
import { paradasDeGradiente } from './contrasteDeTexto'
import { anelDeFocoDoCss, medirAnelDeFoco, type AnelDeFoco } from './contrasteDoAnelDeFoco'
import {
  ANEL,
  CSS_DA_CASCATA,
  PADROES,
  PISO_NAO_TEXTUAL,
  TEMA,
  TOKENS,
  camadasSaoContiguas,
  espessuraTotalPx,
  fundosDoAlvo,
  razaoDoAlvo,
  razaoEntreCamadas,
  razaoMinimaSobreQualquerFundo,
  reprovacoesDoAnel,
  varrerAnel,
} from '../test/medidor-de-contraste'
import { Button } from '../components/ui/Button'
import { Pagination } from '../components/ui/Pagination'
import { Switch } from '../components/ui/Switch'
import { Tabs } from '../components/ui/Tabs'
import { ToastProvider, useToast } from '../components/ui/Toast'

const naoFaz = (): void => undefined

/** Dispara um toast de verdade — o `Toast` monta em portal, fora do container. */
function GatilhoDeToast() {
  const toast = useToast()
  return (
    <button type="button" onClick={() => toast.error('Falha ao salvar.')}>
      disparar-error
    </button>
  )
}

/**
 * O anel EXATO que existia antes desta demanda, escrito por extenso.
 *
 * É o controle positivo do arquivo inteiro: um medidor que morra (que passe a devolver
 * razões altas para tudo, ou a não medir nada) deixa este bloco vermelho. E é a **reversão
 * exata** do defeito — não uma quebra qualquer.
 */
const CSS_DO_ANEL_ANTIGO =
  ':focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }'

const ANEL_ANTIGO: AnelDeFoco = anelDeFocoDoCss(CSS_DO_ANEL_ANTIGO, TOKENS)

function medirCom(anel: AnelDeFoco, raiz: HTMLElement) {
  return medirAnelDeFoco(raiz, { tema: TEMA, padroes: PADROES, anel })
}

/** Monta uma árvore fora do `render()` — usada nos casos de fundo fabricado. */
function arvore(html: string): HTMLElement {
  const fora = document.createElement('div')
  fora.innerHTML = html
  document.body.appendChild(fora)
  return fora
}

describe('o anel medido é o que o CSS do app declara (derivado, nunca digitado)', () => {
  it('duas camadas contíguas, da mais interna para a mais externa — IDENTIDADE', () => {
    // Identidade e não `toContain`: uma camada nova (ou uma que suma) reprova aqui antes
    // de chegar à tela. Os hexes são conferidos contra os TOKENS da cascata logo abaixo,
    // então nem eles são valor digitado à mão.
    expect(ANEL.camadas).toEqual([
      {
        propriedade: 'box-shadow',
        token: '--color-white',
        hex: TOKENS['--color-white'],
        inicioPx: 0,
        espessuraPx: 2,
      },
      {
        propriedade: 'outline',
        token: '--color-primary',
        hex: TOKENS['--color-primary'],
        inicioPx: 2,
        espessuraPx: 2,
      },
    ])
    // E os tokens valem o que o design system publica — se `--color-primary` mudar de
    // valor, é esta linha que conta a história, não um hex solto no meio do teste.
    expect(TOKENS['--color-white']).toBe('#ffffff')
    expect(TOKENS['--color-primary']).toBe('#002f4f')
  })

  it('a FORMA: 4px de espessura, sem vão entre as camadas', () => {
    // Contraste não é tudo: um anel de 1px, ou partido ao meio por um vão que mostra o
    // fundo, é pior de enxergar com a mesma razão de contraste. WCAG 2.4.13 pede ao menos
    // 2px de perímetro; aqui são 4px contíguos.
    expect(espessuraTotalPx(ANEL)).toBe(4)
    expect(camadasSaoContiguas(ANEL)).toBe(true)
    expect(espessuraTotalPx(ANEL)).toBeGreaterThanOrEqual(2)
  })

  it('a regra vive FORA de qualquer `@layer` — é isso que a faz vencer os `ring-*`', () => {
    // Mecanismo, não gosto: no Tailwind v4 os utilitários são emitidos dentro de
    // `@layer utilities`, e declaração NÃO-LAYERED vence declaração layered
    // independentemente da especificidade. É o que faz este anel único substituir os 25
    // `focus-visible:ring-*` espalhados pelos componentes — inclusive o
    // `focus-visible:outline-none` do design system, que sem isso apagaria o anel.
    // Se alguém envolver a regra num `@layer`, o `ring-2` do componente (especificidade
    // maior) passa a vencer e o halo some — em silêncio, porque o CSS continua válido.
    const css = CSS_DA_CASCATA.replace(/\/\*[\s\S]*?\*\//g, '')
    const posicao = css.indexOf(':focus-visible')
    expect(posicao).toBeGreaterThan(0)
    let profundidade = 0
    for (let i = 0; i < posicao; i += 1) {
      if (css[i] === '{') profundidade += 1
      else if (css[i] === '}') profundidade -= 1
    }
    expect(profundidade).toBe(0)
  })

  it('as camadas contrastam ENTRE SI — o anel é lido como desenho, não como borrão', () => {
    // Quando a camada de fora some no fundo (é o que acontece sobre a sidebar), é este
    // contraste que faz a de dentro aparecer como uma borda.
    const entreCamadas = razaoEntreCamadas(ANEL)
    expect(entreCamadas).toHaveLength(1)
    expect(entreCamadas[0].toFixed(2)).toBe('13.82')
    expect(entreCamadas[0]).toBeGreaterThanOrEqual(PISO_NAO_TEXTUAL)
  })
})

describe('`anelDeFocoDoCss` — ou modela, ou LANÇA (nunca devolve um anel que não existe)', () => {
  const REPROVAM: Record<string, { css: string; motivo: RegExp }> = {
    'nenhuma regra `:focus-visible` na cascata': {
      css: 'body { color: red; }',
      motivo: /declara 0 regra\(s\) `:focus-visible`/,
    },
    'duas regras — o vencedor dependeria de camada e especificidade': {
      css:
        ':focus-visible { outline: 2px solid var(--color-primary); } ' +
        'a:focus-visible { outline: 2px solid var(--color-white); }',
      motivo: /declara 2 regra\(s\) `:focus-visible`/,
    },
    '`outline: none` — a ausência de anel nunca passa despercebida': {
      css: ':focus-visible { outline: none; }',
      motivo: /não está na forma "<largura>px solid var\(--color-\*\)"/,
    },
    'cor em hex literal, fora do tema': {
      css: ':focus-visible { outline: 2px solid #002f4f; }',
      motivo: /não está na forma "<largura>px solid var\(--color-\*\)"/,
    },
    'token que não existe na cascata': {
      css: ':focus-visible { outline: 2px solid var(--color-fantasma); }',
      motivo: /"--color-fantasma", que não existe na cascata/,
    },
    'sombra com desfoque — deixa de ser anel de espessura constante': {
      css:
        ':focus-visible { outline: 2px solid var(--color-primary); ' +
        'box-shadow: 0 0 4px 2px var(--color-white); }',
      motivo: /não está na forma "0 0 0 <spread>px var\(--color-\*\)"/,
    },
    'declaração que o modelo não conhece': {
      css:
        ':focus-visible { outline: 2px solid var(--color-primary); ' +
        'border: 2px solid var(--color-accent); }',
      motivo: /`border: 2px solid var\(--color-accent\)`.*não é modelada/s,
    },
    'só `box-shadow`, sem `outline`': {
      css: ':focus-visible { box-shadow: 0 0 0 2px var(--color-white); }',
      motivo: /não declara `outline`/,
    },
  }

  it.each(Object.entries(REPROVAM))('lança: %s', (_nome, { css, motivo }) => {
    expect(() => anelDeFocoDoCss(css, TOKENS)).toThrow(motivo)
  })

  it('lista de seletores é UMA regra, não duas (a contagem discrimina de verdade)', () => {
    // O contrapeso do caso `duas regras`: sem ele, a contagem poderia ficar "mais estrita"
    // de graça (contar ocorrências de `:focus-visible` em vez de blocos) e passar nos dois
    // lados pelo motivo errado.
    const css =
      'a:focus-visible, button:focus-visible { outline: 2px solid var(--color-primary); }'
    expect(anelDeFocoDoCss(css, TOKENS).camadas).toHaveLength(1)
  })

  it('comentário não é declaração — a regra de exemplo dentro de `/* */` é ignorada', () => {
    // Mesmo erro de `padrao in fonte` sobre código: sem tirar os comentários, o exemplo
    // que ESTE arquivo de CSS documenta viraria uma segunda regra e a derivação lançaria.
    const css =
      '/* antes era `:focus-visible { outline: 2px solid var(--color-accent); }` */ ' +
      ':focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }'
    expect(anelDeFocoDoCss(css, TOKENS).camadas.map((c) => c.token)).toEqual(['--color-primary'])
  })
})

describe('CONTROLE POSITIVO — o anel de ANTES reprova, na mesma execução', () => {
  it('sobre `bg-grad-escuro` mede 1,53:1 e 1,00:1 — os números do QA da 125', () => {
    const fora = arvore(
      '<nav class="bg-grad-escuro"><a href="/relatorios/consumo-planos">Consumo de Planos</a></nav>',
    )
    const { medidas, pulados } = medirCom(ANEL_ANTIGO, fora)

    expect(pulados).toEqual([])
    // Uma medida por parada do gradiente: o veredito é o do PIOR ponto, e as duas pontas
    // aparecem porque o fundo varia ao longo do elemento.
    expect(fundosDoAlvo(medidas, 'Consumo de Planos')).toEqual(['#002f4f', '#074b7f'])
    expect(medidas.map((m) => `${m.fundo} ${m.razao.toFixed(2)}`).sort()).toEqual([
      '#002f4f 1.00',
      '#074b7f 1.53',
    ])
    expect(reprovacoesDoAnel(medidas)).toHaveLength(2)
    expect(reprovacoesDoAnel(medidas)[0]).toMatch(/--color-primary/)

    fora.remove()
  })

  it('COMPANHEIRA POSITIVA: o anel de AGORA, no mesmo lugar, mede 9,04:1 e 13,82:1', () => {
    // Sem esta metade, "o anel antigo reprova" não distinguiria "o novo corrigiu" de "a
    // varredura não mede mais nada aqui".
    const fora = arvore(
      '<nav class="bg-grad-escuro"><a href="/relatorios/consumo-planos">Consumo de Planos</a></nav>',
    )
    const { medidas, pulados } = medirCom(ANEL, fora)

    expect(pulados).toEqual([])
    expect(medidas.map((m) => `${m.fundo} ${m.razao.toFixed(2)}`).sort()).toEqual([
      '#002f4f 13.82',
      '#074b7f 9.04',
    ])
    expect(reprovacoesDoAnel(medidas)).toEqual([])

    fora.remove()
  })

  it('a FORMA do anel antigo também reprovava: 2px de anel e 2px de vão', () => {
    // O vão do `outline-offset` mostrava o próprio fundo no meio do indicador. Este é o
    // discriminador do `camadasSaoContiguas` — sem um caso falso, ele passaria sempre.
    expect(camadasSaoContiguas(ANEL_ANTIGO)).toBe(false)
    expect(espessuraTotalPx(ANEL_ANTIGO)).toBe(2)
  })

  it('e reprovava por CONSTRUÇÃO: uma cor só desce a 1,00:1 em algum fundo', () => {
    // A razão pela qual a correção não podia ser "trocar o valor da cor": com uma camada
    // só, existe sempre um fundo que a apaga — o próprio valor dela.
    const { razao } = razaoMinimaSobreQualquerFundo(ANEL_ANTIGO)
    expect(razao.toFixed(2)).toBe('1.00')
    expect(razao).toBeLessThan(PISO_NAO_TEXTUAL)
  })
})

describe('o anel de agora atende 1.4.11 sobre QUALQUER fundo — provado, não amostrado', () => {
  it('o pior fundo concebível rende 3,72:1 (em L ≈ 0,232)', () => {
    // A varredura percorre TODA a faixa de luminância relativa (0 a 1). Nenhuma cor sRGB
    // fica fora dela, então este número é um limite inferior universal — e é o que torna
    // desnecessária (e pior) uma lista de superfícies mantida à mão.
    const { razao, luminancia } = razaoMinimaSobreQualquerFundo(ANEL)
    expect(razao).toBeGreaterThanOrEqual(PISO_NAO_TEXTUAL)
    // O número, e não só "passou": um medidor que devolvesse 21:1 para tudo passaria no
    // piso e falharia aqui.
    expect(razao.toFixed(2)).toBe('3.72')
    expect(luminancia).toBeCloseTo(0.232, 2)
  })

  it('todos os fundos que a app tem — lista DERIVADA da cascata de CSS', () => {
    const { superficies, paradas, gradientesRecusados } = superficiesDaCascata()

    // O universo vem do CSS: todo token de cor + toda parada de gradiente. A cardinalidade
    // é conferida contra a fonte (nunca contra um número escrito à mão): uma varredura que
    // encolha para "o fundo do card" reprova aqui.
    expect(superficies.size).toBeGreaterThanOrEqual(new Set(Object.values(TOKENS)).size)
    expect(superficies.size).toBeGreaterThan(25)
    // As paradas de gradiente, por IDENTIDADE — são elas o fundo do achado `Q-125-5`, e
    // hoje coincidem com dois tokens (`--color-primary-medium` e `--color-primary`), o que
    // torna a cardinalidade sozinha incapaz de provar que o gradiente entrou na varredura.
    expect(paradas).toEqual(['#002f4f', '#074b7f'])
    expect(paradas.every((hex) => superficies.has(hex))).toBe(true)

    // Gradiente cujas paradas não são hexadecimais é RECUSADO, nominalmente — nunca
    // silenciosamente incluído com um fundo presumido.
    expect(gradientesRecusados).toEqual(['bg-grad-card-fill'])

    const reprovando = [...superficies].filter(
      (fundo) => melhorCamada(ANEL, fundo) < PISO_NAO_TEXTUAL,
    )
    expect(reprovando).toEqual([])

    // COMPANHEIRA POSITIVA na mesma execução: o anel antigo reprovava numa porção grande
    // dessas mesmas superfícies, incluindo as duas do gradiente da sidebar.
    const reprovandoAntes = [...superficies].filter(
      (fundo) => melhorCamada(ANEL_ANTIGO, fundo) < PISO_NAO_TEXTUAL,
    )
    expect(reprovandoAntes).toContain('#074b7f')
    expect(reprovandoAntes).toContain('#002f4f')
    expect(reprovandoAntes.length).toBeGreaterThan(5)
  })
})

/** A melhor camada do anel contra um fundo — a razão que vale (ver o módulo). */
function melhorCamada(anel: AnelDeFoco, fundo: string): number {
  return Math.max(...anel.camadas.map((camada) => contrastRatio(camada.hex, fundo)))
}

/**
 * As superfícies do app, derivadas da cascata: todo valor de `--color-*` mais toda parada
 * de cor de todo `@utility` de `background-image`. Nenhuma escrita à mão.
 */
function superficiesDaCascata(): {
  superficies: Set<string>
  paradas: string[]
  gradientesRecusados: string[]
} {
  const superficies = new Set<string>(Object.values(TOKENS))
  const doGradiente = new Set<string>()
  const gradientesRecusados: string[] = []
  for (const [classe, valor] of Object.entries(TEMA.fundosDeImagem)) {
    const resultado = paradasDeGradiente(valor)
    if (resultado.tipo === 'recusa') {
      gradientesRecusados.push(classe)
      continue
    }
    for (const hex of resultado.hexes) {
      superficies.add(hex)
      doGradiente.add(hex)
    }
  }
  return {
    superficies,
    paradas: Array.from(doGradiente).sort(),
    gradientesRecusados: gradientesRecusados.sort(),
  }
}

describe('árvores renderizadas de verdade — o anel medido onde o foco de fato cai', () => {
  it('primitivos com foco sobre `bg-card`: 13,82:1, nada pulado', () => {
    const { container } = render(
      <div className="bg-card">
        <Button onClick={naoFaz}>Salvar</Button>
        <Switch checked={false} onChange={naoFaz} label="Ativo" />
        <Tabs
          items={[
            { id: 'a', label: 'Resumo' },
            { id: 'b', label: 'Detalhe' },
          ]}
          value="a"
          onChange={naoFaz}
          label="Seções"
          baseId="secoes"
        />
      </div>,
    )
    const { medidas, pulados } = varrerAnel(container)

    expect(pulados).toEqual([])
    expect(medidas.length).toBeGreaterThan(2)
    expect(reprovacoesDoAnel(medidas)).toEqual([])
    expect(razaoDoAlvo(medidas, 'Salvar').toFixed(2)).toBe('13.82')
    expect(fundosDoAlvo(medidas, 'Salvar')).toEqual(['#ffffff'])
  })

  it('`Pagination` sobre `bg-background`: a página ativa é `bg-primary` e o anel some no vizinho errado', () => {
    // O botão da página ativa pinta `bg-primary` — a MESMA cor da camada externa do anel.
    // O que salva o indicador não é o fundo do botão (o anel é pintado FORA dele), é o
    // fundo do PAI. Este caso existe para travar essa distinção: se o medidor passasse a
    // usar o fundo do próprio elemento, mediria 1,00:1 e reprovaria aqui.
    const { container } = render(
      <div className="bg-background">
        <Pagination
          page={2}
          pageSize={10}
          totalCount={30}
          totalPages={3}
          onPageChange={naoFaz}
          onPageSizeChange={naoFaz}
        />
      </div>,
    )
    const { medidas, pulados } = varrerAnel(container)

    expect(pulados).toEqual([])
    expect(reprovacoesDoAnel(medidas)).toEqual([])
    expect(razaoDoAlvo(medidas, '2').toFixed(2)).toBe('12.50')
    expect(fundosDoAlvo(medidas, '2')).toEqual(['#f0f4f7'])
  })

  it('sobre fundo ESCURO: o mesmo `Button` mede 13,82:1 pela camada clara', () => {
    // Simetria do caso anterior: o mesmo componente, o mesmo anel, o fundo trocado. Antes
    // desta demanda este número era 1,00:1.
    const { container } = render(
      <div className="bg-primary">
        <Button onClick={naoFaz}>Salvar</Button>
      </div>,
    )
    const { medidas, pulados } = varrerAnel(container)

    expect(pulados).toEqual([])
    expect(reprovacoesDoAnel(medidas)).toEqual([])
    expect(razaoDoAlvo(medidas, 'Salvar').toFixed(2)).toBe('13.82')
    expect(medidas.map((m) => m.porCamada.map((c) => c.razao.toFixed(2)))).toEqual([
      ['13.82', '1.00'],
    ])
  })

  it('`Toast`: superfície colorida E `opacity-60` no próprio focável — 3,76:1', () => {
    // O pior caso REAL da app, e o único focável que dimma a si mesmo: o botão de fechar
    // do `Toast` é `opacity-60`, então o anel dele é composto a 60% sobre o fundo do
    // alerta. Continua acima do piso, mas com folga bem menor que os 11,18:1 que o mesmo
    // fundo daria sem a opacidade — é o número que precisa aparecer, não o "passou".
    // A raiz é o `document.body`: o `Toast` monta em PORTAL, e uma varredura presa ao
    // container de `render()` mediria zero focáveis e "passaria".
    render(
      <ToastProvider>
        <GatilhoDeToast />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('disparar-error'))

    const { medidas, pulados } = varrerAnel(document.body)
    expect(pulados).toEqual([])
    expect(reprovacoesDoAnel(medidas)).toEqual([])
    expect(razaoDoAlvo(medidas, 'Fechar notificação').toFixed(2)).toBe('3.76')
    expect(fundosDoAlvo(medidas, 'Fechar notificação')).toEqual([TOKENS['--color-error-bg']])
  })

  it('fundo que o medidor NÃO modela vira `pulados` — não vira aprovação', () => {
    // A regra da 125: ou modela, ou RECUSA. Um `bg-[#3d5566]` no pai não pode virar "o
    // anel passou" por medição contra o fundo da página.
    const fora = arvore('<div class="bg-[#3d5566]"><button type="button">Salvar</button></div>')
    const { medidas, pulados } = medirCom(ANEL, fora)

    expect(medidas).toEqual([])
    expect(pulados).toHaveLength(1)
    expect(pulados[0].motivo).toMatch(/valor arbitrário/)

    fora.remove()
  })

  it('`opacity` no ancestral apaga o anel junto — e isso é medido', () => {
    // Grupo de pintura: o navegador compõe o elemento E o anel dele sobre o que está
    // atrás. Um anel dentro de um `opacity-25` sobre o card não é o anel de 13,82:1.
    const fora = arvore(
      '<div class="bg-card"><div class="opacity-25"><button type="button">Salvar</button></div></div>',
    )
    const { medidas, pulados } = medirCom(ANEL, fora)

    expect(pulados).toEqual([])
    expect(razaoDoAlvo(medidas, 'Salvar')).toBeLessThan(PISO_NAO_TEXTUAL)
    expect(reprovacoesDoAnel(medidas)).toHaveLength(1)

    fora.remove()
  })
})
