import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildAppointmentsColumns } from './columns'
import { CONTRAST_AUDIT_PAIRS, INVOICY_TONE, statusTone, type StatusTone } from './statusColors'
import { INVOICY_CATEGORY } from '../../ticket-detail/constants'
import type { TicketReportItemDto, TicketStatusCategoria } from '../shared/types/reports'
import { TOKENS, varrer, razaoDoTexto } from '../../../test/medidor-de-contraste'
import { PISO_AA, comAlfa } from '../../../utils/contrasteDeTexto'
import { contrastRatio } from '../../../utils/colorContrast'

/**
 * 125/FE-A11Y-5 (`Q-125-2` do QA) — **a coluna Status do relatório de Apontamentos**.
 *
 * ## O buraco que este arquivo fecha
 *
 * O `fe-a11y-4-report.md` §2 enumerou as ocorrências de `style` inline por `grep` de
 * `style={{…color…}}` e concluiu que *"nenhuma tem texto próprio"*. **Havia uma sexta, com
 * texto, em produção:** `columns.tsx:223` passa `style={tone}` ao `Badge`, e `tone` vem de
 * uma **variável** (`statusTone()`) — o grep por `style={{` não a acha. É a lição do QA: o
 * grep também é enumeração manual quando o que se procura é um **mecanismo**, e não uma
 * string; onde não der para derivar, enumere pelo **efeito** (renderize e olhe
 * `pulados`/`medidas`).
 *
 * A consequência era pior que a frase errada: o medidor **RECUSA** essa coluna (com razão —
 * o valor vem do call site), e **nenhum invariante do repo varria essa coluna**, então a
 * recusa nunca virava reprovação. Uma família inteira de texto colorido de uma tela de
 * produção ficava **fora de qualquer medição**, sem que nada ficasse vermelho.
 *
 * ## O que este arquivo faz — as duas metades, obrigatórias juntas
 *
 * 1. **Registra a coluna como EXPLICITAMENTE PULADA e exercita a recusa** (§1 abaixo). O
 *    universo de tons é **derivado** de `statusTone` sobre a união fechada de
 *    `TicketStatusCategoria` mais os dois ramos que não são categoria (sem categoria e
 *    Invoicy) — nunca uma lista de call sites. Se alguém apagar a recusa de `style` inline,
 *    estes casos ficam vermelhos; se alguém tornar a coluna modelável, também — e aí o
 *    registro é atualizado, no mesmo commit.
 * 2. **Mede o contraste dos tons de verdade** (§2), resolvendo cada `var(--color-*)` contra
 *    a **cascata real de CSS** — que é a fonte que o navegador usa. É este invariante que
 *    passa a cobrir a coluna: um tom novo, ou um token escurecido errado, reprova aqui.
 *
 * A metade 1 sozinha seria prova por ausência ("ninguém mediu, então está tudo bem"); a
 * metade 2 sozinha não notaria a coluna sair da varredura de DOM. É o par que vale.
 */

// ═════════════════════════════════════════════════════════════════════════════════════
// Universo — derivado da união fechada, nunca de uma lista de ocorrências
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * As 4 categorias da união `TicketStatusCategoria`. A trava de identidade abaixo existe
 * porque uma enumeração à mão **encolhe em silêncio**: menos casos nunca é erro para o
 * runner. Categoria nova no backend quebra aqui antes de nascer sem medição.
 */
const CATEGORIAS: TicketStatusCategoria[] = ['aberto', 'emandamento', 'fechado', 'cancelado']

/**
 * Cada tom que a coluna sabe pintar, com a linha de dado que o produz e **a razão
 * esperada, escrita à mão**. Asserção de piso (`>= 4,5`) sozinha não discrimina: ela
 * continua verde se o medidor passar a devolver 21:1 para tudo. O número literal é o que
 * torna o teste capaz de reprovar um token trocado por engano.
 */
const RAZOES: Record<TicketStatusCategoria, string> = {
  aberto: '5.00',
  emandamento: '7.81',
  fechado: '4.75',
  cancelado: '5.24',
}

const TONS: {
  rotulo: string
  categoria: TicketStatusCategoria | null
  invoicy: boolean
  razao: string
}[] = [
  ...CATEGORIAS.map((categoria) => ({
    rotulo: categoria,
    categoria,
    invoicy: false,
    razao: RAZOES[categoria],
  })),
  { rotulo: 'sem categoria (neutro)', categoria: null, invoicy: false, razao: '5.19' },
  { rotulo: 'invoicy (override tomato)', categoria: null, invoicy: true, razao: '6.00' },
]

function linha(overrides?: Partial<TicketReportItemDto>): TicketReportItemDto {
  return {
    ticketId: 1,
    hubspotTicketId: '1001',
    assunto: 'Erro no login',
    clienteNome: 'ACME',
    equipe: 'Relacionamento BR',
    ownerNome: 'Ana',
    status: 'Em atendimento',
    categoria: null,
    totalSeconds: 3600,
    apontamentosCount: 2,
    hubspotUrl: null,
    totalSecondsAllTime: 3600,
    apontamentosCountAllTime: 2,
    statusNome: null,
    statusCategoria: null,
    categoriasTimer: [],
    ...overrides,
  }
}

/** Renderiza a célula REAL da coluna Status sobre o card e varre o que ela pinta. */
function varrerCelulaDeStatus(overrides?: Partial<TicketReportItemDto>) {
  const coluna = buildAppointmentsColumns().find((c) => c.key === 'status')
  if (coluna === undefined) throw new Error('A coluna `status` sumiu de `buildAppointmentsColumns`.')
  const { container } = render(<div className="bg-card">{coluna.accessor(linha(overrides))}</div>)
  return varrer(container.firstElementChild as Element)
}

// ═════════════════════════════════════════════════════════════════════════════════════
// §1 — a coluna é EXPLICITAMENTE PULADA, e a recusa é exercitada em todos os tons
// ═════════════════════════════════════════════════════════════════════════════════════

describe('coluna Status — registro explícito de recusa (Q-125-2)', () => {
  it('a união `TicketStatusCategoria` tem exatamente estas 4 categorias', () => {
    // Identidade, não cardinalidade: cardinalidade passa quando uma entra e outra sai.
    const doTipo: Record<TicketStatusCategoria, true> = {
      aberto: true,
      emandamento: true,
      fechado: true,
      cancelado: true,
    }
    expect(new Set(CATEGORIAS)).toEqual(new Set(Object.keys(doTipo)))
    expect(TONS).toHaveLength(CATEGORIAS.length + 2)
  })

  it.each(TONS)(
    'tom "$rotulo": o badge é RECUSADO pela varredura de DOM — nunca medido com a cor herdada',
    ({ categoria, invoicy }) => {
      const { medidas, pulados } = varrerCelulaDeStatus({
        status: 'Em atendimento',
        statusCategoria: categoria,
        categoria: invoicy ? INVOICY_CATEGORY : null,
      })

      // A recusa é o comportamento CERTO: o valor de `style={tone}` vem do call site.
      // O que estava errado era ninguém varrer esta coluna para vê-la acontecer.
      expect(pulados.map((p) => p.texto)).toEqual(['Em atendimento'])
      // Nomeia a declaração `color:` — não basta "foi recusado". A recusa aqui é
      // sobredeterminada (o tom traz cor E fundo), e um detector que aceite qualquer
      // motivo continuaria verde com a recusa de COR removida.
      expect(pulados[0].motivo).toMatch(/declara "color:/)
      expect(pulados[0].motivo).toMatch(/atributo `style`/)
      expect(medidas.map((m) => m.texto)).not.toContain('Em atendimento')
    },
  )

  it('COMPANHEIRA POSITIVA: sem status a mesma coluna é MEDIDA, e o `—` passa AA', () => {
    // Sem esta metade, "o badge não foi medido" seria indistinguível de "a varredura
    // parou de medir a coluna inteira" — e as asserções acima passariam vazias.
    const { medidas, pulados } = varrerCelulaDeStatus({ status: null })

    expect(pulados).toEqual([])
    expect(razaoDoTexto(medidas, '—')).toBeGreaterThanOrEqual(PISO_AA)
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════
// §2 — o invariante que passa a COBRIR a coluna: os tons medidos contra a cascata real
// ═════════════════════════════════════════════════════════════════════════════════════

/** `#rrggbb` a partir de canais 0–255. */
function hexDeCanais(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

const REGEX_VAR = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i
const REGEX_HEX = /^#[0-9a-f]{6}$/i
const REGEX_RGBA = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/i

/**
 * Resolve um valor de tom a um hex opaco, já composto sobre `fundo`.
 *
 * **Lança** no que não souber resolver — o tom é usado como cor de texto numa tela de
 * produção, e "não sei medir" nunca pode virar "está tudo bem".
 */
function hexDoTom(valor: string, fundo: string): string {
  const porVariavel = REGEX_VAR.exec(valor)
  if (porVariavel !== null) {
    const hex = TOKENS[porVariavel[1]]
    if (hex === undefined) {
      throw new Error(
        `O tom aponta para "${porVariavel[1]}", que não existe na cascata de CSS do app.`,
      )
    }
    return hex
  }
  if (REGEX_HEX.test(valor)) return valor.toLowerCase()
  const porRgba = REGEX_RGBA.exec(valor)
  if (porRgba !== null) {
    const [, r, g, b, alfa] = porRgba
    return comAlfa(hexDeCanais(Number(r), Number(g), Number(b)), fundo, Number(alfa ?? '1'))
  }
  throw new Error(`Valor de tom não resolvível: "${valor}".`)
}

/** A razão de contraste real de um tom, sobre o fundo do card onde a tabela vive. */
function razaoDoTom(tom: StatusTone): { fg: string; bg: string; razao: number } {
  const card = TOKENS['--color-card']
  const bg = hexDoTom(tom.backgroundColor, card)
  const fg = hexDoTom(tom.color, bg)
  return { fg, bg, razao: contrastRatio(fg, bg) }
}

describe('coluna Status — contraste dos tons, medido contra a cascata real', () => {
  it.each(TONS)('tom "$rotulo" mede $razao:1 com os tokens que o CSS publica', ({
    categoria,
    invoicy,
    razao: esperada,
  }) => {
    const { razao } = razaoDoTom(statusTone(categoria, invoicy))
    expect(razao.toFixed(2)).toBe(esperada)
    expect(razao).toBeGreaterThanOrEqual(PISO_AA)
  })

  it('CONTROLE POSITIVO: o mesmo medidor REPROVA o laranja claro que a 125 escureceu', () => {
    // Sem ele, "todos passam" seria indistinguível de um medidor morto. `#e07600` é o valor
    // exato que `--color-warning-fg` tinha antes de 125/FE-A11Y-3 (3,00:1).
    const { razao } = razaoDoTom({
      color: '#e07600',
      backgroundColor: 'var(--color-warning-bg)',
    })
    expect(razao).toBeLessThan(PISO_AA)
    expect(razao.toFixed(2)).toBe('3.00')
  })

  it('o override Invoicy é composto sobre o card antes de medir (o fundo tem alfa)', () => {
    const { fg, bg, razao } = razaoDoTom(INVOICY_TONE)
    expect(fg).toBe('#b31b00')
    expect(bg).toBe('#ffece9')
    expect(razao.toFixed(2)).toBe('6.00')
  })

  it('`CONTRAST_AUDIT_PAIRS` não diverge da cascata — os hexes espelhados são os reais', () => {
    // Dois inventários à mão sobre o mesmo conjunto divergem; a única questão é quando.
    // Aqui o espelho em TypeScript é confrontado com o que o CSS de fato publica.
    const daCascata = TONS.map(({ rotulo, categoria, invoicy }) => {
      const { fg, bg } = razaoDoTom(statusTone(categoria, invoicy))
      return { rotulo, fg, bg }
    })
    const neutro = daCascata.find((t) => t.rotulo === 'sem categoria (neutro)')
    expect(neutro).toBeDefined()

    for (const par of CONTRAST_AUDIT_PAIRS) {
      const equivalente = daCascata.find((t) => t.rotulo.startsWith(par.label.split(' ')[0]))
      expect(equivalente, `par "${par.label}" sem tom correspondente`).toBeDefined()
      expect({ label: par.label, fg: par.fg, bg: par.bg }).toEqual({
        label: par.label,
        fg: equivalente!.fg,
        bg: equivalente!.bg,
      })
    }
  })
})
