import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  TOKENS,
  classesDoTexto,
  fundoDoTexto,
  razaoDoTexto,
  reprovacoesAA,
  reprovacoesDasFrases,
  varrer,
} from './medidor-de-contraste'
import { PISO_AA, comAlfa } from '../utils/contrasteDeTexto'
import { contrastRatio } from '../utils/colorContrast'
import { Badge } from '../components/ui/Badge'
import { TimeEntryCard } from '../features/ticket-detail/components/TimeEntryCard'
import { TimeEntryModal } from '../features/ticket-detail/components/TimeEntryModal'
import { CancelTimeEntryDialog } from '../features/ticket-detail/components/CancelTimeEntryDialog'
import { INVOICY_CATEGORY } from '../features/ticket-detail/constants'
import { TicketDetailHeader } from '../features/ticket-detail/components/TicketDetailHeader'
import { LogsTable } from '../features/sincronizador/components/LogsTable'
import { buildClientTicketsColumns } from '../features/client-tickets/columns'
import { buildMovimentacaoDiariaColumns } from '../features/movimentacao-diaria/columns'
import { buildAppointmentsColumns } from '../features/reports/appointments/columns'
import type { TicketTimeEntryDto, TicketHeaderDto } from '../features/ticket-detail/types/ticketDetail'
import type { MovimentacaoDiariaRowDto } from '../features/movimentacao-diaria/types/movimentacaoDiaria'
import type { TicketReportItemDto } from '../features/reports/shared/types/reports'
import type { LogDto } from '../features/sincronizador/types/sincronizador'
import { ToastProvider } from '../components/ui/Toast'

/**
 * 125/FE-A11Y-3 — as **três reprovações de contraste que sobraram** da demanda 125,
 * medidas **no DOM renderizado**, antes e depois.
 *
 * | Achado | O que era | Onde |
 * |---|---|---|
 * | `A-1` | `text-foreground/40` = **2,34:1** (e **1,78:1** no card cancelado) | 8 pontos, varridos da árvore inteira |
 * | `P-1` | `text-warning-fg` sobre `bg-warning-bg` = **3,00:1** | token de `styles/global.css` |
 * | `P-2` | `text-badge-origem-ticket-fg` sobre o `-bg` = **2,83:1** | token de `styles/global.css` |
 *
 * ## Três armadilhas que este arquivo existe para não repetir
 *
 * 1. **Opacidade no ancestral é GRUPO, não texto.** O card de apontamento CANCELADO ERA
 *    `bg-card opacity-70`: o navegador pinta fundo + texto e compõe **o conjunto** sobre a
 *    página, então a opacidade da classe se soma à do grupo. Ali `text-foreground/70` media
 *    3,00:1, não 5,47:1 — a correção "troque tudo por `/70`" passaria num teste que não
 *    modelasse o grupo e continuaria reprovando na tela. Por isso cada ponto do
 *    `TimeEntryCard` é medido **nos dois estados**, e o número do cancelado é diferente do
 *    número do ativo em **toda** asserção.
 *
 *    ⚠️ Desde 125/`Q-1` o grupo NÃO EXISTE MAIS: o card cancelado recua por fundo próprio
 *    (`bg-background`). O texto passava mesmo dentro do grupo (com o token cheio), mas os
 *    QUATRO badges do card reprovavam, e nenhum valor de token os salvava — o token do
 *    badge já é composto antes da opacidade entrar em cena. O invariante que impede o grupo
 *    de voltar (a QUALQUER elemento do card, não só ao `<article>`) mora em
 *    `src/test/contraste-q1-card-cancelado.test.tsx`. O modelo de grupo do medidor continua
 *    testado — em fixture sintética — aqui e em `utils/contrasteDeTexto.test.ts`.
 * 2. **Nem toda ocorrência da classe é texto.** O `•` do `Breadcrumb` é `aria-hidden` e
 *    decorativo; ele foi MEDIDO (2,31:1) e deliberadamente NÃO trocado — e o teste prova a
 *    classificação no DOM, com o texto irmão continuando a ser medido (companheira
 *    positiva, para a regra de `aria-hidden` não engolir a árvore em silêncio).
 * 3. **Fundo em GRADIENTE não tem "um" contraste.** A sidebar tem
 *    `background-image: linear-gradient(...)`. Quando esta unidade foi escrita, o medidor não
 *    modelava `background-image` nenhum — o número saía errado ou a varredura lançava, e por
 *    isso o cálculo aqui era feito à mão. Desde 125/FE-A11Y-4 (`Q-3`) o medidor **deriva as
 *    paradas do CSS real e mede uma vez por parada**, então o veredito é o do PIOR ponto sem
 *    ninguém escolher qual medir. A sidebar real é varrida em `layout/Sidebar.test.tsx`.
 *
 * ## O que faz cada asserção ficar vermelha
 *
 * Nenhuma afirma só "não reprovou": cada ponto afirma **a classe que o DOM renderizou**,
 * **o fundo efetivo** e **o número**. `razaoDoTexto` LANÇA quando a frase não foi medida,
 * então nenhuma passa vazia; `varredura.pulados` é asserido `[]` em todos os casos, então
 * nada é descartado em silêncio. O bloco `controle positivo` obriga o mesmo medidor a
 * REPROVAR os valores de ANTES na mesma execução.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────────────

function apontamento(overrides: Partial<TicketTimeEntryDto> = {}): TicketTimeEntryDto {
  return {
    id: 1,
    userId: 1,
    agenteNome: 'Maria',
    serviceCategoryId: 2,
    categorizacaoNome: 'Consultoria',
    billableOutsidePlan: false,
    status: 'COMPLETED',
    startTime: '2026-06-19T11:00:00Z',
    endTime: '2026-06-19T12:00:00Z',
    totalSeconds: 3600,
    note: null,
    pendingCategory: false,
    canceladoPorUserId: null,
    canceladoPorNome: null,
    segments: [
      { id: 10, type: 'WORK', segmentStart: '2026-06-19T11:00:00Z', segmentEnd: '2026-06-19T12:00:00Z' },
    ],
    ...overrides,
  }
}

function ticketReport(overrides: Partial<TicketReportItemDto> = {}): TicketReportItemDto {
  return {
    ticketId: 1,
    hubspotTicketId: '1001',
    assunto: 'Erro ao emitir nota',
    clienteNome: 'ACME',
    equipe: 'BR',
    ownerNome: 'Ana',
    status: null,
    totalSeconds: 60,
    apontamentosCount: 1,
    hubspotUrl: null,
    totalSecondsAllTime: 60,
    apontamentosCountAllTime: 1,
    statusNome: null,
    statusCategoria: null,
    categoriasTimer: [],
    fechadoEm: null,
    entraNaFatura: null,
    ...overrides,
  }
}

const CARD = TOKENS['--color-card']
/** Fundo da página — e, desde 125/`Q-1`, também o fundo próprio do card CANCELADO. */
const BACKGROUND = TOKENS['--color-background']
const PAGINA = TOKENS['--color-background']

/** Renderiza um nó sobre uma superfície real do app e devolve a varredura. */
function medirSobre(superficie: string, no: React.ReactNode) {
  const { container } = render(<div className={superficie}>{no}</div>)
  return varrer(container.firstElementChild as Element)
}

// ═════════════════════════════════════════════════════════════════════════════════════
// A-1 — `text-foreground/40`: a varredura da ÁRVORE INTEIRA, não só dos dois arquivos
// ═════════════════════════════════════════════════════════════════════════════════════

describe('A-1 · TimeEntryCard — o `/40` da lista de segmentos, nos DOIS estados', () => {
  it('ATIVO: a duração do segmento herda `/70` do <li> e mede 5,47:1 sobre o card', () => {
    const { container } = render(
      <div className="bg-card">
        <TimeEntryCard entry={apontamento()} canEdit={false} onEdit={vi.fn()} />
      </div>,
    )
    const { medidas, pulados } = varrer(container.firstElementChild as Element)

    expect(pulados).toEqual([])
    // A classe que o DOM renderiza — não a que o JSX pretende. Antes era `/40`.
    expect(classesDoTexto(medidas, '· 1h 0m')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, '· 1h 0m')).toEqual([CARD])
    expect(razaoDoTexto(medidas, '· 1h 0m').toFixed(2)).toBe('5.47')
    expect(reprovacoesDasFrases(medidas, ['· 1h 0m'])).toEqual([])
  })

  // REESCRITO em 125/`Q-1` (decisão do usuário em 2026-09-07, alternativa A do
  // comparativo). Antes este teste afirmava o desenho de HOJE: `opacity-70` no `<article>`,
  // fundo composto (≠ CARD) e token CHEIO no texto, medindo 5,59:1. Aquele desenho passava
  // no TEXTO e reprovava os QUATRO BADGES do card (3,76 / 2,86 / 3,81 / 2,86 — a medição
  // está em `q1-comparativo-visual.md` §3). O grupo saiu; o cancelado recua por fundo
  // próprio. O teste NÃO foi apagado: ele afirma agora o desenho novo, no mesmo commit.
  it('CANCELADO: sem grupo, o fundo é `--color-background` e o `/70` mede 5,20:1', () => {
    const { container } = render(
      <div className="bg-background">
        <TimeEntryCard
          entry={apontamento({ status: 'CANCELLED', canceladoPorNome: 'João', note: 'Duplicado' })}
          canEdit={false}
          onEdit={vi.fn()}
        />
      </div>,
    )
    const { medidas, pulados } = varrer(container.firstElementChild as Element)

    expect(pulados).toEqual([])
    // O token cheio saiu junto com o grupo: com o card opaco, ele deixaria o texto do
    // cancelado MAIS forte que o do ativo (13,82 contra 5,47) — hierarquia invertida.
    expect(classesDoTexto(medidas, '· 1h 0m')).toEqual(['text-foreground/70'])
    // O fundo agora é conhecido e opaco — e é o do próprio card, não o card branco.
    expect(fundoDoTexto(medidas, '· 1h 0m')).toEqual([BACKGROUND])
    expect(fundoDoTexto(medidas, '· 1h 0m')).not.toEqual([CARD])
    expect(razaoDoTexto(medidas, '· 1h 0m').toFixed(2)).toBe('5.20')

    // Os irmãos do mesmo card, no mesmo estado — a correção não pode ser de um ponto só.
    expect(razaoDoTexto(medidas, '→').toFixed(2)).toBe('5.20') // linha do segmento
    expect(razaoDoTexto(medidas, 'sem pausa').toFixed(2)).toBe('5.20') // linha de meta
    // A caixa de motivo INVERTEU de superfície (`bg-badge-neutro-bg` → `bg-card`), senão
    // ela se fundiria ao card: `--color-badge-neutro-bg` e `--color-background` são o mesmo
    // #f0f4f7. Sobre o card branco o mesmo `/70` mede 5,47:1 — a inversão SOBE o contraste.
    expect(fundoDoTexto(medidas, 'Motivo: Duplicado')).toEqual([CARD])
    expect(razaoDoTexto(medidas, 'Motivo: Duplicado').toFixed(2)).toBe('5.47')
    expect(
      reprovacoesDasFrases(medidas, ['· 1h 0m', '→', 'sem pausa', 'Motivo: Duplicado']),
    ).toEqual([])
  })

  it('DESCARTADO não tem grupo: a caixa de motivo fica em `/70` e mede 5,20:1', () => {
    // Prova que a condicional discrimina por ESTADO, e não "sempre token cheio".
    const { container } = render(
      <div className="bg-card">
        <TimeEntryCard
          entry={apontamento({ status: 'DISCARDED', canceladoPorNome: 'João', note: 'Refeito' })}
          canEdit={false}
          onEdit={vi.fn()}
        />
      </div>,
    )
    const { medidas, pulados } = varrer(container.firstElementChild as Element)

    expect(pulados).toEqual([])
    expect(classesDoTexto(medidas, 'Motivo: Refeito')).toEqual(['text-foreground/70'])
    expect(razaoDoTexto(medidas, 'Motivo: Refeito').toFixed(2)).toBe('5.20')
    expect(razaoDoTexto(medidas, '· 1h 0m').toFixed(2)).toBe('5.47')
  })
})

describe('A-1 · células de tabela — o travessão é conteúdo, não decoração', () => {
  /** Renderiza o `accessor` de uma coluna e devolve a varredura sobre a superfície do card. */
  function medirCelula(no: React.ReactNode) {
    return medirSobre('bg-card', no)
  }

  it('client-tickets: "Status", "Concluído em" e "Na fatura" vazios medem 5,47:1', () => {
    const colunas = buildClientTicketsColumns()
    const linha = ticketReport()
    for (const chave of ['status', 'concluidoEm', 'naFatura']) {
      const coluna = colunas.find((c) => c.key === chave)
      if (!coluna) throw new Error(`Coluna "${chave}" não existe mais — a varredura ficaria vazia.`)
      const { medidas, pulados } = medirCelula(coluna.accessor(linha))
      expect(pulados, `coluna ${chave}`).toEqual([])
      expect(classesDoTexto(medidas, '—'), `coluna ${chave}`).toEqual(['text-foreground/70'])
      expect(fundoDoTexto(medidas, '—'), `coluna ${chave}`).toEqual([CARD])
      expect(razaoDoTexto(medidas, '—').toFixed(2), `coluna ${chave}`).toBe('5.47')
    }
  })

  it('reports/appointments: categorias vazias e status ausente medem 5,47:1', () => {
    const colunas = buildAppointmentsColumns()
    const linha = ticketReport()
    for (const chave of ['categoriasTimer', 'status']) {
      const coluna = colunas.find((c) => c.key === chave)
      if (!coluna) throw new Error(`Coluna "${chave}" não existe mais — a varredura ficaria vazia.`)
      const { medidas, pulados } = medirCelula(coluna.accessor(linha))
      expect(pulados, `coluna ${chave}`).toEqual([])
      expect(classesDoTexto(medidas, '—'), `coluna ${chave}`).toEqual(['text-foreground/70'])
      expect(razaoDoTexto(medidas, '—').toFixed(2), `coluna ${chave}`).toBe('5.47')
    }
  })

  it('movimentação diária: "Sem equipe" é texto de conteúdo e mede 5,47:1', () => {
    const linha: MovimentacaoDiariaRowDto = {
      id: 1,
      data: '2026-06-19',
      statusBucket: 'novos',
      statusLabel: null,
      equipeId: null,
      equipe: null,
      quantidade: 3,
      atualizadoEm: '2026-06-19T12:00:00Z',
    }
    const coluna = buildMovimentacaoDiariaColumns().find((c) => c.key === 'equipe')
    if (!coluna) throw new Error('Coluna "equipe" não existe mais — a varredura ficaria vazia.')
    const { medidas, pulados } = medirCelula(coluna.accessor(linha))
    expect(pulados).toEqual([])
    expect(classesDoTexto(medidas, 'Sem equipe')).toEqual(['text-foreground/70'])
    expect(razaoDoTexto(medidas, 'Sem equipe').toFixed(2)).toBe('5.47')
  })

  it('sincronizador/LogsTable: o travessão era `/30` (1,84:1) e passa a 5,47:1', () => {
    const log: LogDto = {
      logId: 1,
      tipo: 'empresas',
      status: 'concluido',
      disparo: 'automatico',
      iniciadoEm: '2026-06-19T11:00:00Z',
      finalizadoEm: '2026-06-19T11:00:10Z',
      duracaoMs: 10_000,
      ticketsUpserted: 0,
      ticketsIgnorados: 0,
      projetosUpserted: 0,
      projetosIgnorados: 0,
      empresasResolvidas: 0,
      contatosResolvidos: 0,
      empresasCriadas: 1,
      empresasAtualizadas: 0,
      empresasDesativadas: 0,
      mensagemErro: null,
    }
    const { medidas, pulados } = medirSobre(
      'bg-card',
      <LogsTable data={[log]} sortBy="iniciadoem" sortDirection="desc" onSort={vi.fn()} />,
    )
    expect(pulados).toEqual([])
    const classes = new Set(classesDoTexto(medidas, '—'))
    expect(classes).toEqual(new Set(['text-foreground/70']))
    expect(razaoDoTexto(medidas, '—').toFixed(2)).toBe('5.47')
    expect(reprovacoesDasFrases(medidas, ['—'])).toEqual([])
  })
})

describe('A-1 · placeholder de campo é TEXTO — e não aparece na varredura do DOM', () => {
  /**
   * O `placeholder` é pintado por um pseudo-elemento; em jsdom não existe nó de texto para
   * ele, então a varredura de contraste **não o vê**. Prova por classe do DOM + aritmética
   * sobre os tokens da cascata — nunca hex digitado.
   */
  const razaoDoPlaceholder = (alfa: number): number =>
    contrastRatio(comAlfa(TOKENS['--color-foreground'], CARD, alfa), CARD)

  it('CancelTimeEntryDialog: `placeholder:text-foreground/70` = 5,47:1 (era /40 = 2,34:1)', () => {
    render(
      <CancelTimeEntryDialog isOpen onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    const campo = screen.getByRole('textbox')
    expect(campo.className).toContain('placeholder:text-foreground/70')
    expect(campo.className).not.toContain('placeholder:text-foreground/40')
    expect(razaoDoPlaceholder(0.7).toFixed(2)).toBe('5.47')
    expect(razaoDoPlaceholder(0.7)).toBeGreaterThanOrEqual(PISO_AA)
    // Companheira negativa, na mesma execução: o valor de ANTES continua reprovando.
    expect(razaoDoPlaceholder(0.4).toFixed(2)).toBe('2.34')
    expect(razaoDoPlaceholder(0.4)).toBeLessThan(PISO_AA)
  })

  it('TimeEntryModal: o campo de observação usa a mesma classe corrigida', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <TimeEntryModal
            isOpen
            mode="edit"
            ticketId={1}
            ticketLabel="#4321"
            entry={apontamento()}
            agentOptions={[]}
            categoryOptions={[]}
            // 133: prop obrigatória; sem trava (a categoria do apontamento não força).
            categoriasQueForcam={new Set()}
            canChangeAgent={false}
            currentUserId={1}
            canManage={false}
            onClose={vi.fn()}
            onRequestCancel={vi.fn()}
            onSubmitted={vi.fn()}
          />
        </ToastProvider>
      </QueryClientProvider>,
    )
    const area = container.ownerDocument.querySelector('textarea')
    if (area === null) throw new Error('O <textarea> de observação sumiu — a asserção passaria vazia.')
    expect(area.className).toContain('placeholder:text-foreground/70')
    expect(area.className).not.toContain('placeholder:text-foreground/40')
  })
})

describe('A-1 · o que NÃO foi trocado, com a medição que sustenta a decisão', () => {
  it('o `•` do Breadcrumb continua em `/40` porque é `aria-hidden` e decorativo', () => {
    // Medição do par real: 2,31:1 sobre a página. Abaixo do piso AA — que é piso de TEXTO.
    const razaoDoBullet = contrastRatio(
      comAlfa(TOKENS['--color-foreground'], PAGINA, 0.4),
      PAGINA,
    )
    expect(razaoDoBullet.toFixed(2)).toBe('2.31')
    expect(razaoDoBullet).toBeLessThan(PISO_AA)

    // E a classificação, provada no DOM: o separador sai da medição por `aria-hidden`,
    // enquanto o texto irmão CONTINUA sendo medido — sem essa companheira positiva, a
    // regra de `aria-hidden` poderia engolir a árvore inteira e "0 reprovações" seria
    // indistinguível de "não mediu nada".
    const { medidas, pulados } = medirSobre(
      'bg-background',
      <nav className="text-xs text-foreground/70">
        <span aria-hidden="true" className="text-foreground/40">
          •
        </span>
        <span>Relatórios</span>
      </nav>,
    )
    expect(pulados).toEqual([])
    expect(medidas.map((m) => m.texto)).toContain('Relatórios')
    expect(medidas.some((m) => m.texto === '•')).toBe(false)
    expect(razaoDoTexto(medidas, 'Relatórios').toFixed(2)).toBe('5.20')
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════
// A-1 (extra) — a sidebar: fundo em GRADIENTE, invisível para o medidor de token
// ═════════════════════════════════════════════════════════════════════════════════════

describe('A-1 extra · títulos de grupo da sidebar sobre `bg-grad-escuro`', () => {
  /**
   * 125/FE-A11Y-4 reescreveu este bloco. Ele **era** aritmética à mão sobre hexes extraídos
   * do CSS por uma regex própria — uma SEGUNDA derivação do mesmo gradiente, ao lado da do
   * medidor. Hoje o medidor modela o gradiente por parada (`utils/contrasteDeTexto.ts`), e
   * quem deriva as pontas é ele: aqui só se afirma o número, medindo no DOM.
   *
   * A varredura da sidebar REAL (com os mocks de router e permissões que ela exige, e nos
   * estados ativo e inativo) fica em `components/layout/Sidebar.test.tsx`.
   */
  const medirSobreGradiente = (classe: string) => {
    const fora = document.createElement('div')
    fora.innerHTML = `<nav class="bg-grad-escuro"><span class="${classe}">Dashboards</span></nav>`
    document.body.appendChild(fora)
    const resultado = varrer(fora)
    fora.remove()
    return resultado
  }

  it('mede as DUAS pontas do gradiente derivadas do `tokens.css` do design system', () => {
    const { medidas, pulados } = medirSobreGradiente('text-white/70')
    expect(pulados).toEqual([])
    expect(medidas.map((m) => m.fundo)).toEqual(['#074b7f', '#002f4f'])
  })

  it('`/70` passa nas DUAS pontas; `/60`, o valor de antes, reprova na ponta clara', () => {
    const bom = medirSobreGradiente('text-white/70')
    const ruim = medirSobreGradiente('text-white/60')

    // Depois: passa nas duas pontas — o veredito é o do PIOR caso, não o da média.
    expect(bom.medidas.map((m) => m.razao.toFixed(2))).toEqual(['5.31', '7.50'])
    expect(razaoDoTexto(bom.medidas, 'Dashboards')).toBeGreaterThanOrEqual(PISO_AA)
    expect(reprovacoesAA(bom.medidas)).toEqual([])

    // Antes: a ponta ESCURA passava (5,89) e a CLARA reprovava (4,33). Medir só uma
    // superfície teria devolvido "passa" para um texto que reprova em metade da barra.
    expect(ruim.medidas.map((m) => m.razao.toFixed(2))).toEqual(['4.33', '5.89'])
    expect(razaoDoTexto(ruim.medidas, 'Dashboards')).toBeLessThan(PISO_AA)
    expect(reprovacoesAA(ruim.medidas)).toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════
// P-1 e P-2 — os dois tokens laranja, medidos NO DOM nos call sites reais
// ═════════════════════════════════════════════════════════════════════════════════════

describe('P-1 · `--color-warning-fg` escurecido — medido nos call sites de texto', () => {
  it('Badge "Pausado" mede 5,00:1 sobre `bg-warning-bg` (era 3,00:1)', () => {
    const { medidas, pulados } = medirSobre('bg-card', <Badge value="Pausado" />)
    expect(pulados).toEqual([])
    expect(classesDoTexto(medidas, 'Pausado')).toEqual(['text-warning-fg'])
    expect(fundoDoTexto(medidas, 'Pausado')).toEqual([TOKENS['--color-warning-bg']])
    expect(razaoDoTexto(medidas, 'Pausado').toFixed(2)).toBe('5.00')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('aviso Invoicy do TicketDetailHeader mede 5,00:1 (era 3,00:1)', () => {
    const ticket: TicketHeaderDto = {
      id: 1,
      hubspotTicketId: '4321',
      assunto: 'Erro ao emitir nota',
      // A categoria vem da constante do domínio — digitá-la aqui faria o aviso sumir em
      // silêncio se ela mudasse, e a asserção passaria a medir uma tela sem o aviso.
      categoria: INVOICY_CATEGORY,
      pipelineStage: 'Em atendimento',
      owner: null,
      client: null,
      requester: null,
      hubspotUrl: null,
      conteudo: null,
      hsCriadoEm: null,
    }
    const { medidas, pulados } = medirSobre(
      'bg-card',
      <TicketDetailHeader ticket={ticket} canCreate={false} onAddAppointment={vi.fn()} />,
    )
    expect(pulados).toEqual([])
    expect(classesDoTexto(medidas, 'horas vão para análise')).toEqual(['text-warning-fg'])
    expect(fundoDoTexto(medidas, 'horas vão para análise')).toEqual([TOKENS['--color-warning-bg']])
    expect(razaoDoTexto(medidas, 'horas vão para análise').toFixed(2)).toBe('5.00')
  })

  it('badge "Executando" da tabela de logs mede 5,00:1', () => {
    const log: LogDto = {
      logId: 1,
      tipo: 'tickets',
      status: 'executando',
      disparo: 'manual',
      iniciadoEm: '2026-06-19T11:00:00Z',
      finalizadoEm: null,
      duracaoMs: null,
      ticketsUpserted: 10,
      ticketsIgnorados: 0,
      projetosUpserted: 0,
      projetosIgnorados: 0,
      empresasResolvidas: 0,
      contatosResolvidos: 0,
      empresasCriadas: 0,
      empresasAtualizadas: 0,
      empresasDesativadas: 0,
      mensagemErro: null,
    }
    const { medidas, pulados } = medirSobre(
      'bg-card',
      <LogsTable data={[log]} sortBy="iniciadoem" sortDirection="desc" onSort={vi.fn()} />,
    )
    expect(pulados).toEqual([])
    expect(classesDoTexto(medidas, 'Executando')).toEqual(['text-warning-fg'])
    expect(razaoDoTexto(medidas, 'Executando').toFixed(2)).toBe('5.00')
  })
})

describe('P-2 · `--color-badge-origem-ticket-fg` escurecido — o par irmão remedido junto', () => {
  it('Badge "Ticket" mede 4,72:1 sobre o `-bg` (era 2,83:1)', () => {
    const { medidas, pulados } = medirSobre('bg-card', <Badge value="Ticket" />)
    expect(pulados).toEqual([])
    expect(classesDoTexto(medidas, 'Ticket')).toEqual(['text-badge-origem-ticket-fg'])
    expect(fundoDoTexto(medidas, 'Ticket')).toEqual([TOKENS['--color-badge-origem-ticket-bg']])
    expect(razaoDoTexto(medidas, 'Ticket').toFixed(2)).toBe('4.72')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('Badge "Projeto" — o par irmão JÁ passava (7,81:1) e por isso NÃO foi alterado', () => {
    // A pendência exigia decidir os dois juntos, para não ficarem discrepantes. Medir e
    // não mexer é decisão, desde que a medição esteja escrita — está, aqui.
    const { medidas, pulados } = medirSobre('bg-card', <Badge value="Projeto" />)
    expect(pulados).toEqual([])
    expect(classesDoTexto(medidas, 'Projeto')).toEqual(['text-badge-origem-projeto-fg'])
    expect(razaoDoTexto(medidas, 'Projeto').toFixed(2)).toBe('7.81')
    expect(TOKENS['--color-badge-origem-projeto-fg']).toBe('#074b7f')
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════
// Controle positivo — o medidor é obrigado a REPROVAR os valores de ANTES
// ═════════════════════════════════════════════════════════════════════════════════════

describe('controle positivo — os pares de ANTES continuam reprovando no mesmo medidor', () => {
  it.each([
    ['A-1 · text-foreground/40 sobre o card', 'foreground', 0.4, 'card', '2.34'],
    ['A-1 · text-foreground/40 sobre a página', 'foreground', 0.4, 'background', '2.31'],
    ['A-1 · text-foreground/30 dos logs sobre o card', 'foreground', 0.3, 'card', '1.84'],
  ])('REPROVA %s', (_nome, token, alfa, fundo, esperado) => {
    const hexFundo = TOKENS[`--color-${fundo}`]
    const medido = contrastRatio(comAlfa(TOKENS[`--color-${token}`], hexFundo, alfa), hexFundo)
    expect(medido.toFixed(2)).toBe(esperado)
    expect(medido).toBeLessThan(PISO_AA)
  })

  it.each([
    ['P-1 · #e07600 sobre --color-warning-bg', '#e07600', '--color-warning-bg', '3.00'],
    ['P-2 · #e07600 sobre --color-badge-origem-ticket-bg', '#e07600', '--color-badge-origem-ticket-bg', '2.83'],
  ])('REPROVA %s — o valor HISTÓRICO, escrito à mão', (_nome, hexAntigo, tokenDeFundo, esperado) => {
    // Escrito à mão de propósito: lê-lo da cascata o tornaria verde junto com a correção,
    // e o controle positivo viraria inerte sem ninguém notar.
    const medido = contrastRatio(hexAntigo, TOKENS[tokenDeFundo])
    expect(medido.toFixed(2)).toBe(esperado)
    expect(medido).toBeLessThan(PISO_AA)
  })

  it('REPROVA no DOM `text-foreground/40` sobre o card — não só na aritmética', () => {
    const { medidas, pulados } = medirSobre(
      'bg-card',
      <p className="text-xs text-foreground/40">· 1h 0m como era antes</p>,
    )
    expect(pulados).toEqual([])
    expect(razaoDoTexto(medidas, 'como era antes').toFixed(2)).toBe('2.34')
    expect(reprovacoesAA(medidas)).toHaveLength(1)
  })

  it('REPROVA no DOM o `/40` DENTRO do grupo `opacity-70` — 1,78:1, o pior de todos', () => {
    // É a medição que a `FE-A11Y-2` relatou como `A-1` e que nenhuma unidade tinha feito.
    // Sem modelar o grupo, este mesmo texto mediria 2,34 e o número da tela ficaria oculto.
    const { medidas, pulados } = medirSobre(
      'bg-background',
      <article className="bg-card opacity-70">
        <span className="text-foreground/40">· 1h 0m no card cancelado</span>
      </article>,
    )
    expect(pulados).toEqual([])
    expect(razaoDoTexto(medidas, 'no card cancelado').toFixed(2)).toBe('1.78')
    expect(reprovacoesAA(medidas)).toHaveLength(1)
  })

  it('APROVA `text-foreground/70` sobre o card (5,47:1) — o medidor não reprova tudo', () => {
    const medido = contrastRatio(comAlfa(TOKENS['--color-foreground'], CARD, 0.7), CARD)
    expect(medido.toFixed(2)).toBe('5.47')
    expect(medido).toBeGreaterThanOrEqual(PISO_AA)
  })
})
