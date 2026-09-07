import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  PADROES,
  TEMA,
  TOKENS,
  classesDoTexto,
  fundoDoTexto,
  razaoDoTexto,
  reprovacoesAA,
  reprovacoesDasFrases,
  varrer,
} from './medidor-de-contraste'
import { PISO_AA, comAlfa, contextoDePintura, opacidadeDoElemento } from '../utils/contrasteDeTexto'
import { contrastRatio, relativeLuminance } from '../utils/colorContrast'
import { TimeEntryCard } from '../features/ticket-detail/components/TimeEntryCard'
import type { TicketTimeEntryDto } from '../features/ticket-detail/types/ticketDetail'

/**
 * 125/`Q-1` — o card de apontamento CANCELADO recua por SUPERFÍCIE, nunca por opacidade
 * de grupo. Decisão do usuário em 2026-09-07, alternativa **A** de
 * `.dev-team/demandas/125-contraste-design-system/q1-comparativo-visual.md`.
 *
 * ## O defeito que este arquivo existe para impedir de voltar
 *
 * `opacity-70` no `<article>` do card é um **grupo de pintura**: o navegador pinta o cartão
 * inteiro — fundo *e* texto *e* todo filho — e compõe **o conjunto** sobre a página. Os
 * badges desbotam junto, e **nenhum valor de token os salva**, porque o token do badge já
 * foi composto antes de a opacidade entrar em cena. Medido no DOM, os QUATRO badges do card
 * cancelado reprovavam AA com os MESMOS tokens que passam no card ativo logo acima.
 *
 * E a escala não tem solução: a primeira parada de `opacity-*` em que os quatro passam é
 * `opacity-95` — um esmaecimento imperceptível, com margem de 0,18 sobre o piso
 * (`q1-comparativo-visual.md` §3.1). Esmaecimento que se VÊ é esmaecimento que quebra AA.
 *
 * ## O que faz cada asserção ficar vermelha
 *
 * 1. **`o mecanismo`** — a varredura procura opacidade **em qualquer elemento do card**
 *    (classe `opacity-*` *ou* `style="opacity:…"`), não a string `opacity-70` no
 *    `<article>`. Devolver o grupo por outro elemento, ou com outro valor, reprova igual.
 *    A varredura conta quantos nós inspecionou e afirma o número: lista vazia por não ter
 *    olhado nada seria verde, e é exatamente assim que um invariante morre em silêncio.
 * 2. **`controle positivo`** — o MESMO caminho de código, na MESMA execução, roda sobre uma
 *    fixture com o desenho ANTIGO e tem de acusar o grupo e reprovar os quatro badges.
 *    Os números do "antes" são **escritos à mão**: derivá-los do componente os tornaria
 *    verdes junto com a correção, e o controle viraria inerte sem ninguém notar.
 * 3. **`superfície`** — a redução do custo visual de A é afirmada por MEDIÇÃO da superfície
 *    pintada (via `contextoDePintura`, o mesmo modelo de fundo do medidor de texto), com
 *    companheira positiva no card ATIVO: "difere do card" tem de valer nos dois estados,
 *    senão a asserção passaria por o card estar vazio.
 * 4. **`peso da barra`** — a barra da linha do tempo é comparada, em luminância relativa,
 *    com o composto que o `opacity-70` produzia. O lado esquerdo vem do DOM; o lado direito
 *    vem dos tokens do CSS real. Nenhum dos dois é derivado do outro.
 *
 * `pulados` é asserido `[]` em toda varredura — nada é descartado em silêncio.
 */

// ── Fixture ────────────────────────────────────────────────────────────────────────────

function apontamento(overrides: Partial<TicketTimeEntryDto> = {}): TicketTimeEntryDto {
  return {
    id: 1,
    userId: 1,
    agenteNome: 'Marcos Andrade',
    serviceCategoryId: 2,
    // Valor FORA do `BADGE_MAP` — é o fallback neutro, o badge que a alternativa A apagaria.
    categorizacaoNome: 'Suporte tecnico',
    billableOutsidePlan: false,
    status: 'CANCELLED',
    startTime: '2026-07-08T11:55:00Z',
    endTime: '2026-07-08T12:40:00Z',
    totalSeconds: 0,
    note: 'Aberto no ticket errado.',
    pendingCategory: false,
    canceladoPorUserId: 9,
    canceladoPorNome: 'Gestor Demo',
    segments: [
      { id: 10, type: 'WORK', segmentStart: '2026-07-08T11:55:00Z', segmentEnd: '2026-07-08T12:35:00Z' },
      { id: 11, type: 'PAUSE', segmentStart: '2026-07-08T12:35:00Z', segmentEnd: '2026-07-08T12:40:00Z' },
    ],
    ...overrides,
  }
}

/** Monta o card sobre a página real (`--color-background`) e devolve `<article>` + varredura. */
function renderizarCard(status: 'CANCELLED' | 'COMPLETED') {
  const { container } = render(
    <div className="bg-background">
      <TimeEntryCard
        entry={apontamento({ status, totalSeconds: status === 'CANCELLED' ? 0 : 2700 })}
        canEdit={false}
        onEdit={vi.fn()}
      />
    </div>,
  )
  const pagina = container.firstElementChild as HTMLElement
  const artigo = pagina.querySelector('article') as HTMLElement
  return { pagina, artigo, ...varrer(pagina) }
}

const CARD = TOKENS['--color-card']
const BACKGROUND = TOKENS['--color-background']

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · O MECANISMO — nenhuma opacidade de grupo em elemento nenhum do card
// ═══════════════════════════════════════════════════════════════════════════════════════

type NoOpaco = { tag: string; classe: string; opacidade: number }

/**
 * Varre a subárvore inteira (raiz inclusive) atrás de QUALQUER grupo de opacidade.
 *
 * Lê `getAttribute('class')` em vez de `.className` de propósito: em `<svg>` a propriedade
 * é um `SVGAnimatedString`, e um `opacity-50` num ícone passaria despercebido. E soma a
 * opacidade INLINE, que é a porta dos fundos mais óbvia para reintroduzir o grupo sem
 * escrever a classe.
 */
function gruposDeOpacidade(raiz: Element): { encontrados: NoOpaco[]; inspecionados: number } {
  const nos = [raiz, ...Array.from(raiz.querySelectorAll('*'))]
  const encontrados: NoOpaco[] = []
  for (const no of nos) {
    const classe = no.getAttribute('class') ?? ''
    const inline = no instanceof HTMLElement ? no.style.opacity : ''
    const fatorInline = inline === '' ? 1 : Number(inline)
    const opacidade = opacidadeDoElemento(classe) * fatorInline
    if (opacidade < 1) encontrados.push({ tag: no.tagName.toLowerCase(), classe, opacidade })
  }
  return { encontrados, inspecionados: nos.length }
}

describe('`Q-1` · o mecanismo — o card cancelado não tem grupo de opacidade em lugar nenhum', () => {
  it('nenhum elemento do card CANCELADO compõe por opacidade (e a varredura não é vazia)', () => {
    const { artigo } = renderizarCard('CANCELLED')
    const { encontrados, inspecionados } = gruposDeOpacidade(artigo)

    // Não-vacuidade primeiro: sem isso, "lista vazia" também é o resultado de não olhar.
    expect(inspecionados).toBeGreaterThan(20)
    expect(encontrados).toEqual([])
  })

  it('o card ATIVO também não tem — o recuo do cancelado nunca foi feito por opacidade', () => {
    const { artigo } = renderizarCard('COMPLETED')
    const { encontrados, inspecionados } = gruposDeOpacidade(artigo)

    expect(inspecionados).toBeGreaterThan(20)
    expect(encontrados).toEqual([])
  })

  it('controle positivo do MECANISMO: a mesma varredura ACUSA o desenho antigo', () => {
    // Se esta asserção ficar verde com `encontrados: []`, as duas de cima não provam nada.
    const { container } = render(
      <div className="bg-background">
        <article className="rounded-card border border-border bg-card p-4 opacity-70">
          <span className="text-foreground">Marcos Andrade</span>
        </article>
      </div>,
    )
    const { encontrados, inspecionados } = gruposDeOpacidade(
      container.querySelector('article') as Element,
    )

    expect(inspecionados).toBeGreaterThan(1)
    expect(encontrados).toHaveLength(1)
    expect(encontrados[0].tag).toBe('article')
    expect(encontrados[0].opacidade).toBeCloseTo(0.7, 10)
  })

  it('controle positivo do MECANISMO: acusa também opacidade INLINE, não só a classe', () => {
    const { container } = render(
      <div className="bg-background">
        <article className="rounded-card bg-card p-4" style={{ opacity: 0.7 }}>
          <span className="text-foreground">Marcos Andrade</span>
        </article>
      </div>,
    )
    const { encontrados } = gruposDeOpacidade(container.querySelector('article') as Element)

    expect(encontrados).toHaveLength(1)
    expect(encontrados[0].opacidade).toBeCloseTo(0.7, 10)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · OS QUATRO BADGES — o número medido no DOM, depois e antes
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Os quatro badges do card cancelado, na ordem em que aparecem na tela. */
const BADGES = ['Cancelado', 'Suporte tecnico', 'Trabalho', 'Pausa'] as const

describe('`Q-1` · os quatro badges do card cancelado passam AA — medido no DOM', () => {
  it('DEPOIS: cada badge afirma classe, fundo efetivo e razão, e nenhum reprova', () => {
    const { medidas, pulados } = renderizarCard('CANCELLED')

    expect(pulados).toEqual([])

    // "Cancelado" — badge com cor própria no mapa: a superfície NÃO muda no card recuado.
    // A palavra aparece DUAS vezes no card (a pílula e o prefixo da caixa de motivo), em
    // superfícies diferentes; `razaoDoTexto` devolve o MÍNIMO, que é o da pílula.
    expect(fundoDoTexto(medidas, 'Cancelado')).toEqual([TOKENS['--color-error-bg'], CARD])
    expect(razaoDoTexto(medidas, 'Cancelado').toFixed(2)).toBe('5.24')

    // "Suporte tecnico" — fallback NEUTRO. `--color-badge-neutro-bg` é o MESMO #f0f4f7 de
    // `--color-background`: sobre o card recuado a pílula sumiria. A superfície inverte
    // para `bg-card`, e o texto SOBE de 5,19:1 para 5,74:1.
    expect(fundoDoTexto(medidas, 'Suporte tecnico')).toEqual([CARD])
    expect(razaoDoTexto(medidas, 'Suporte tecnico').toFixed(2)).toBe('5.74')

    // "Trabalho" — `bg-badge-plano-bg`, cor própria: inalterado.
    expect(fundoDoTexto(medidas, 'Trabalho')).toEqual([TOKENS['--color-badge-plano-bg']])
    expect(razaoDoTexto(medidas, 'Trabalho').toFixed(2)).toBe('7.81')

    // "Pausa" — a pílula neutra da lista de segmentos, mesma inversão do badge.
    expect(fundoDoTexto(medidas, 'Pausa')).toEqual([CARD])
    expect(razaoDoTexto(medidas, 'Pausa').toFixed(2)).toBe('5.74')

    for (const badge of BADGES) {
      expect(razaoDoTexto(medidas, badge)).toBeGreaterThanOrEqual(PISO_AA)
    }
    expect(reprovacoesDasFrases(medidas, [...BADGES])).toEqual([])
    // A árvore inteira do card, não só os quatro pontos escolhidos a dedo.
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('DEPOIS: o texto secundário volta ao `/70` dos dois estados — 5,20:1 sobre o recuo', () => {
    const { medidas, pulados } = renderizarCard('CANCELLED')

    expect(pulados).toEqual([])
    // Sem grupo, o token CHEIO deixaria o cancelado MAIS forte que o ativo (13,82 × 5,47).
    expect(classesDoTexto(medidas, '1 pausa(s)')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, '1 pausa(s)')).toEqual([BACKGROUND])
    expect(razaoDoTexto(medidas, '1 pausa(s)').toFixed(2)).toBe('5.20')
    // A caixa de motivo inverteu de superfície junto com as pílulas neutras.
    expect(fundoDoTexto(medidas, 'Motivo: Aberto no ticket errado.')).toEqual([CARD])
    expect(razaoDoTexto(medidas, 'Motivo: Aberto no ticket errado.').toFixed(2)).toBe('5.47')
  })

  it('ANTES (controle positivo): o desenho de HOJE reprova os quatro, no mesmo medidor', () => {
    // Os tokens são os do CSS real; o que está escrito à mão é o DESENHO ANTIGO — o
    // `opacity-70` no `<article>` e as superfícies neutras sem inversão. Lê-lo do
    // componente o tornaria verde junto com a correção.
    const pilula = 'inline-flex items-center rounded-pill px-2 py-0.5 font-medium'
    const { container } = render(
      <div className="bg-background">
        <article className="rounded-card border border-border bg-card p-4 opacity-70">
          <span className={`${pilula} bg-error-bg text-error-fg`}>Cancelado</span>
          <span className={`${pilula} bg-badge-neutro-bg text-badge-neutro-fg`}>
            Suporte tecnico
          </span>
          <span className={`${pilula} bg-badge-plano-bg text-badge-plano-fg`}>Trabalho</span>
          <span className={`${pilula} bg-badge-neutro-bg text-badge-neutro-fg`}>Pausa</span>
        </article>
      </div>,
    )
    const { medidas, pulados } = varrer(container.firstElementChild as Element)

    expect(pulados).toEqual([])
    expect(razaoDoTexto(medidas, 'Cancelado').toFixed(2)).toBe('3.76')
    expect(razaoDoTexto(medidas, 'Suporte tecnico').toFixed(2)).toBe('2.86')
    expect(razaoDoTexto(medidas, 'Trabalho').toFixed(2)).toBe('3.81')
    expect(razaoDoTexto(medidas, 'Pausa').toFixed(2)).toBe('2.86')
    for (const badge of BADGES) {
      expect(razaoDoTexto(medidas, badge)).toBeLessThan(PISO_AA)
    }
    expect(reprovacoesAA(medidas)).toHaveLength(4)
  })

  it('ANTES (controle positivo): nem `opacity-95` resolve com folga — 4,68 contra 4,5', () => {
    // A prova de que a escala de opacidade não tinha saída: o único valor em que os quatro
    // passam é imperceptível E deixa 0,18 de margem. Qualquer token um tom mais claro, ou
    // um badge novo, volta a reprovar sem ninguém tocar no arquivo.
    const pilula = 'inline-flex items-center rounded-pill px-2 py-0.5 font-medium'
    const { container } = render(
      <div className="bg-background">
        <article className="rounded-card border border-border bg-card p-4 opacity-95">
          <span className={`${pilula} bg-badge-neutro-bg text-badge-neutro-fg`}>Pausa</span>
        </article>
      </div>,
    )
    const { medidas, pulados } = varrer(container.firstElementChild as Element)

    expect(pulados).toEqual([])
    expect(razaoDoTexto(medidas, 'Pausa').toFixed(2)).toBe('4.68')
    expect(razaoDoTexto(medidas, 'Pausa') - PISO_AA).toBeLessThan(0.2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · A SUPERFÍCIE — o custo visual declarado de A, pago sem voltar à opacidade
// ═══════════════════════════════════════════════════════════════════════════════════════

/** A cor opaca efetivamente pintada atrás do elemento, pelo modelo de fundo do medidor. */
function superficieDe(elemento: Element): string {
  const contexto = contextoDePintura(elemento, TEMA, PADROES.fundo)
  if (contexto.tipo === 'recusa') {
    throw new Error(`Superfície não modelável: ${contexto.motivo}`)
  }
  const cenarios = contexto.cenarios
  if (cenarios.length !== 1) {
    throw new Error(`Esperava 1 cenário de pintura, veio ${cenarios.length} (gradiente?).`)
  }
  if (cenarios[0].grupos.length > 0) {
    throw new Error('Há grupo de opacidade acima do elemento — a superfície não é sólida.')
  }
  return cenarios[0].fundoLocal
}

/** Acha o elemento cujo texto é exatamente `texto` (o nó mais interno que o contém). */
function elementoComTexto(raiz: Element, texto: string): Element {
  const candidatos = Array.from(raiz.querySelectorAll('*')).filter(
    (no) => no.textContent?.trim() === texto,
  )
  const alvo = candidatos.at(-1)
  if (alvo === undefined) throw new Error(`Nenhum elemento com o texto exato "${texto}".`)
  return alvo
}

describe('`Q-1` · a superfície — pílula neutra e caixa de motivo NÃO se fundem ao card', () => {
  it('CANCELADO: card, pílula neutra e caixa de motivo são três superfícies medidas', () => {
    const { artigo } = renderizarCard('CANCELLED')

    const doCard = superficieDe(artigo)
    expect(doCard).toBe(BACKGROUND)

    // O custo declarado da alternativa A era exatamente este: com o card em #f0f4f7 e o
    // neutro em #f0f4f7, badge e caixa viravam texto solto. As três medições provam que não.
    const daPilula = superficieDe(elementoComTexto(artigo, 'Pausa'))
    const doBadge = superficieDe(elementoComTexto(artigo, 'Suporte tecnico'))
    const daCaixa = superficieDe(
      elementoComTexto(artigo, 'Cancelado por Gestor Demo · Motivo: Aberto no ticket errado.'),
    )

    expect(daPilula).toBe(CARD)
    expect(doBadge).toBe(CARD)
    expect(daCaixa).toBe(CARD)
    for (const superficie of [daPilula, doBadge, daCaixa]) {
      expect(superficie).not.toBe(doCard)
    }
  })

  it('ATIVO (companheira positiva): as mesmas três também diferem do card branco', () => {
    // Sem este par, "difere do card" passaria num estado em que o card fosse outra coisa.
    const { artigo } = renderizarCard('COMPLETED')

    const doCard = superficieDe(artigo)
    expect(doCard).toBe(CARD)

    const daPilula = superficieDe(elementoComTexto(artigo, 'Pausa'))
    const doBadge = superficieDe(elementoComTexto(artigo, 'Suporte tecnico'))
    expect(daPilula).toBe(TOKENS['--color-badge-neutro-bg'])
    expect(doBadge).toBe(TOKENS['--color-badge-neutro-bg'])
    expect(daPilula).not.toBe(doCard)
    expect(doBadge).not.toBe(doCard)
  })

  it('a inversão não custa contraste de texto: o neutro sobe de 5,19 para 5,74', () => {
    const neutroSobreNeutro = contrastRatio(
      TOKENS['--color-badge-neutro-fg'],
      TOKENS['--color-badge-neutro-bg'],
    )
    const neutroSobreCard = contrastRatio(TOKENS['--color-badge-neutro-fg'], CARD)

    expect(neutroSobreNeutro.toFixed(2)).toBe('5.19')
    expect(neutroSobreCard.toFixed(2)).toBe('5.74')
    expect(neutroSobreCard).toBeGreaterThan(neutroSobreNeutro)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · O PESO DA BARRA — a linha do tempo não vira o elemento mais forte do card
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('`Q-1` · a linha do tempo do cancelado mantém o peso que a opacidade dava', () => {
  /** A barra de TRABALHO do card (a primeira barra dentro do `role="img"`). */
  function barraDeTrabalho(artigo: Element): Element {
    const linha = artigo.querySelector('[role="img"]')
    if (linha === null) throw new Error('A linha do tempo não foi renderizada.')
    const barras = Array.from(linha.querySelectorAll(':scope > div'))
    if (barras.length === 0) throw new Error('A linha do tempo veio sem barras.')
    return barras[0]
  }

  it('a barra do cancelado tem a MESMA luminância do composto que o `opacity-70` produzia', () => {
    const { artigo } = renderizarCard('CANCELLED')
    const medida = relativeLuminance(superficieDe(barraDeTrabalho(artigo)))

    // Lado direito derivado dos TOKENS do CSS real + o 0,7 histórico. Nada aqui vem do DOM,
    // então a igualdade não é tautologia: são dois caminhos independentes.
    const compostoDeHoje = comAlfa(TOKENS['--color-primary'], BACKGROUND, 0.7)
    expect(medida).toBeCloseTo(relativeLuminance(compostoDeHoje), 3)

    // E o discriminador: as alternativas óbvias NÃO satisfazem a asserção acima.
    for (const token of ['--color-primary', '--color-primary-light'] as const) {
      expect(Math.abs(relativeLuminance(TOKENS[token]) - medida)).toBeGreaterThan(0.002)
    }
  })

  it('a barra continua acima do piso não-textual de 3:1 contra o card recuado', () => {
    const { artigo } = renderizarCard('CANCELLED')
    const razao = contrastRatio(superficieDe(barraDeTrabalho(artigo)), BACKGROUND)

    expect(razao.toFixed(2)).toBe('5.19')
    expect(razao).toBeGreaterThanOrEqual(3)
  })

  it('o card ATIVO conserva a barra `--color-primary` cheia — a troca é só do recuado', () => {
    const { artigo } = renderizarCard('COMPLETED')
    expect(superficieDe(barraDeTrabalho(artigo))).toBe(TOKENS['--color-primary'])
  })
})
