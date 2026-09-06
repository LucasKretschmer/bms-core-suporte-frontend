import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contrastRatio } from '../../utils/colorContrast'
import type { CalendarDto, ScheduleDto } from './types/calendar'

// ── Contraste (QA `D-2`) — os hexes são LIDOS do CSS real, nunca espelhados à mão ────
const PISO_AA = 4.5
const CSS_APP = 'src/styles/global.css'
const CSS_DS = 'node_modules/@migrate/design-system/styles.css'

function tokenDoCss(caminho: string, token: string): string {
  const css = readFileSync(caminho, 'utf8')
  const casamento = new RegExp(token + ':[^#]{0,20}(#[0-9a-fA-F]{6})').exec(css)
  if (casamento === null) throw new Error(`Token ${token} não encontrado em ${caminho}`)
  return casamento[1]
}

/** Composição de cor com alfa sobre um fundo opaco — o que `/30` e `/70` fazem. */
function comAlfa(fg: string, bg: string, alfa: number): string {
  const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const [r1, g1, b1] = canais(fg)
  const [r2, g2, b2] = canais(bg)
  const mistura = [
    [r1, r2],
    [g1, g2],
    [b1, b2],
  ].map(([a, b]) => Math.round(a * alfa + b * (1 - alfa)))
  return `#${mistura.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

const {
  mockUsePermissions,
  mockUseCalendars,
  mockUseSchedule,
  mockCreate,
  mockUpdate,
  mockSalvarExpediente,
  mockRefetchCalendars,
} = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
  mockUseCalendars: vi.fn(),
  mockUseSchedule: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSalvarExpediente: vi.fn(),
  mockRefetchCalendars: vi.fn(),
}))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('./hooks/useBusinessCalendar', () => ({
  useCalendars: mockUseCalendars,
  useSchedule: mockUseSchedule,
  useHolidays: vi.fn(() => ({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() })),
  // Sem datas retroativas em jogo nesta tela: a pré-contagem não consulta nada.
  useHolidayImpacts: vi.fn(() => []),
  CALENDARS_QUERY_KEY: ['calendars'],
  scheduleQueryKey: (id: number) => ['calendars', id, 'schedule'],
  holidaysQueryKey: (id: number) => ['calendars', id, 'holidays'],
}))
vi.mock('./hooks/useCalendarMutations', () => ({
  useCalendarMutations: () => ({
    create: { mutateAsync: mockCreate, isPending: false },
    update: { mutateAsync: mockUpdate, isPending: false },
    salvarExpediente: { mutateAsync: mockSalvarExpediente, isPending: false },
  }),
}))
vi.mock('./hooks/useHolidayMutations', () => ({
  useHolidayMutations: () => ({
    create: { mutateAsync: vi.fn(), isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
    importar: { mutateAsync: vi.fn(), isPending: false },
  }),
}))

import BusinessCalendarPage from './index'

const calendarios: CalendarDto[] = [
  { id: 1, nome: 'Comercial', padrao: false, ignorarFeriados: false, slaPadraoMinutos: null },
  { id: 2, nome: 'Padrão SP', padrao: true, ignorarFeriados: false, slaPadraoMinutos: 30 },
]

const schedule: ScheduleDto = { vigente: null, versoes: [] }

const GERENTE = { isCoordenadorOuAcima: true, isGerentePlus: true }
const COORDENADOR = { isCoordenadorOuAcima: true, isGerentePlus: false }
const ATENDENTE = { isCoordenadorOuAcima: false, isGerentePlus: false }

function comDados(
  overrides: {
    papel?: { isCoordenadorOuAcima: boolean; isGerentePlus: boolean }
    calendars?: { data?: CalendarDto[]; isLoading?: boolean; isError?: boolean }
  } = {},
) {
  const papel = overrides.papel ?? GERENTE
  mockUsePermissions.mockReturnValue({
    role: null,
    isAtendente: !papel.isCoordenadorOuAcima,
    isGestor: papel.isCoordenadorOuAcima,
    primaryTeamId: null,
    isAuthenticated: true,
    ...papel,
  })
  mockUseCalendars.mockReturnValue({
    data: overrides.calendars?.data ?? calendarios,
    isLoading: overrides.calendars?.isLoading ?? false,
    isError: overrides.calendars?.isError ?? false,
    refetch: mockRefetchCalendars,
  })
  mockUseSchedule.mockReturnValue({
    data: schedule,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
}

describe('BusinessCalendarPage — permissão e estados', () => {
  beforeEach(() => vi.clearAllMocks())

  it('atendente não entra', () => {
    comDados({ papel: ATENDENTE })
    render(<BusinessCalendarPage />)
    expect(screen.getByText('Você não tem permissão para acessar esta área.')).toBeInTheDocument()
  })

  it('carregando mostra skeleton', () => {
    comDados({ calendars: { data: undefined, isLoading: true } })
    render(<BusinessCalendarPage />)
    expect(screen.getByLabelText('Carregando…')).toBeInTheDocument()
  })

  it('erro mostra retry', async () => {
    comDados({ calendars: { data: undefined, isError: true } })
    render(<BusinessCalendarPage />)
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(mockRefetchCalendars).toHaveBeenCalled()
  })

  it('vazio significa NÃO CONFIGURADO — com a consequência escrita e o caminho de saída', async () => {
    comDados({ calendars: { data: [] } })
    render(<BusinessCalendarPage />)

    const regiao = screen.getByRole('status')
    expect(regiao).toHaveTextContent('Nenhum calendário comercial configurado')
    expect(regiao).toHaveTextContent('SLA de 1º atendimento fica sem apuração')
    expect(screen.queryByText(/nenhum resultado/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Criar calendário' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Novo calendário comercial')
  })

  /**
   * QA `D-2` — a frase que explica a consequência de não configurar era renderizada a
   * **1,84:1** pelo `EmptyState` compartilhado. A classe medida aqui é a que o elemento
   * REALMENTE renderiza (lida do DOM), não a passada a um wrapper: foi exatamente por ler
   * a classe do wrapper que o defeito passou despercebido.
   */
  it('D-2: o vazio NÃO usa o EmptyState do DS, e o par de cores passa AA', () => {
    comDados({ calendars: { data: [] } })
    render(<BusinessCalendarPage />)

    const titulo = screen.getByText('Nenhum calendário comercial configurado')
    const corpo = screen.getByText(/o tempo útil não é calculado/)

    // A classe do DS (`text-xs italic text-primary/30`) não está em nenhum dos dois.
    expect(titulo.className).toContain('text-foreground')
    expect(titulo.className).not.toContain('text-primary/30')
    expect(corpo.className).toContain('text-foreground/70')
    expect(corpo.className).not.toContain('text-primary/30')
    expect(corpo.className).not.toContain('italic')

    const fg = tokenDoCss(CSS_APP, '--color-foreground')
    const bg = tokenDoCss(CSS_APP, '--color-card')
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(PISO_AA)
    expect(contrastRatio(comAlfa(fg, bg, 0.7), bg)).toBeGreaterThanOrEqual(PISO_AA)

    // Controle positivo do medidor: o par do DS que o QA mediu REPROVA de fato — se este
    // assert virar verde-por-acidente, o medidor morreu.
    const primary = tokenDoCss(CSS_DS, '--color-primary')
    expect(contrastRatio(comAlfa(primary, bg, 0.3), bg)).toBeLessThan(2)
  })

  it('coordenador vê a tela vazia sem o caminho de escrita', () => {
    comDados({ papel: COORDENADOR, calendars: { data: [] } })
    render(<BusinessCalendarPage />)
    expect(screen.getByText('Nenhum calendário comercial configurado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar calendário' })).not.toBeInTheDocument()
  })
})

describe('BusinessCalendarPage — seleção e abas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sem escolha do usuário, começa pelo calendário PADRÃO (não pelo primeiro da lista)', () => {
    comDados()
    render(<BusinessCalendarPage />)
    expect(screen.getByRole('combobox', { name: /Calendário/ })).toHaveTextContent(
      'Padrão SP (padrão)',
    )
    expect(mockUseSchedule).toHaveBeenCalledWith(2)
  })

  it('trocar de calendário carrega o expediente do escolhido', async () => {
    comDados()
    render(<BusinessCalendarPage />)
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('combobox', { name: /Calendário/ }))
    await usuario.click(await screen.findByRole('option', { name: 'Comercial' }))

    await waitFor(() => expect(mockUseSchedule).toHaveBeenLastCalledWith(1))
  })

  it('as duas abas existem e o expediente é a inicial', async () => {
    comDados()
    render(<BusinessCalendarPage />)

    expect(screen.getByRole('tab', { name: 'Expediente' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Feriados' })).toHaveAttribute('aria-selected', 'false')

    await userEvent.click(screen.getByRole('tab', { name: 'Feriados' }))
    expect(screen.getByRole('tab', { name: 'Feriados' })).toHaveAttribute('aria-selected', 'true')
  })

  it('mostra a meta padrão do calendário, e "sem meta" quando ela é null', async () => {
    comDados()
    render(<BusinessCalendarPage />)
    expect(screen.getByText(/Meta padrão: 30 min\./)).toBeInTheDocument()

    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('combobox', { name: /Calendário/ }))
    await usuario.click(await screen.findByRole('option', { name: 'Comercial' }))

    // `null` é "não configurado", nunca "0 min".
    expect(await screen.findByText(/Sem meta padrão de 1º atendimento\./)).toBeInTheDocument()
  })

  it('coordenador não recebe as ações de escrita da tela', () => {
    comDados({ papel: COORDENADOR })
    render(<BusinessCalendarPage />)
    expect(screen.queryByRole('button', { name: 'Novo calendário' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar calendário/ })).not.toBeInTheDocument()
  })
})
