import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HolidayDto, HolidayImpactDto } from '../types/calendar'

const {
  mockUseHolidays,
  mockGetHolidayImpact,
  mockCreate,
  mockUpdate,
  mockRemove,
  mockImportar,
  mockRefetch,
} = vi.hoisted(() => ({
  mockUseHolidays: vi.fn(),
  mockGetHolidayImpact: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockRemove: vi.fn(),
  mockImportar: vi.fn(),
  mockRefetch: vi.fn(),
}))

// Mock PARCIAL: `useHolidays` e substituido (a listagem nao e o assunto aqui), mas
// `useHolidayImpacts` fica REAL, atravessando o react-query ate o servico — e o que faz a
// contagem do dialogo ser provadamente a da rota.
vi.mock('../hooks/useBusinessCalendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useBusinessCalendar')>()),
  useHolidays: mockUseHolidays,
}))
vi.mock('../services/businessCalendarService', () => ({
  getHolidayImpact: mockGetHolidayImpact,
  getSchedule: vi.fn(),
  listCalendars: vi.fn(),
  listHolidays: vi.fn(),
}))
vi.mock('../hooks/useHolidayMutations', () => ({
  useHolidayMutations: () => ({
    create: { mutateAsync: mockCreate, isPending: false },
    update: { mutateAsync: mockUpdate, isPending: false },
    remove: { mutateAsync: mockRemove, isPending: false },
    importar: { mutateAsync: mockImportar, isPending: false },
  }),
}))

import { HolidaysSection } from './HolidaysSection'

const HOJE = new Date('2026-09-06T15:00:00Z') // 06/09/2026 em São Paulo

const feriados: HolidayDto[] = [
  { id: 1, data: '2026-03-04', nome: 'Carnaval' }, // quarta-feira, PASSADO
  { id: 2, data: '2026-12-25', nome: 'Natal' }, // sexta-feira, futuro
]

function comPagina(
  overrides: {
    items?: HolidayDto[]
    isLoading?: boolean
    isError?: boolean
    totalCount?: number
  } = {},
) {
  const items = overrides.items ?? feriados
  mockUseHolidays.mockReturnValue({
    data:
      overrides.isLoading === true || overrides.isError === true
        ? undefined
        : {
            items,
            totalCount: overrides.totalCount ?? items.length,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: mockRefetch,
  })
}

function impacto(data: string, retroativo: boolean, tickets: number): HolidayImpactDto {
  return { data, avisoRetroativo: retroativo, ticketsFechadosNoDia: tickets }
}

function renderizar(podeEditar = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <HolidaysSection calendarId={3} nomeDoCalendario="Padrão" podeEditar={podeEditar} />
    </QueryClientProvider>,
  )
}

describe('HolidaysSection — estados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('carregando mostra skeleton', () => {
    comPagina({ isLoading: true })
    renderizar()
    expect(screen.getByLabelText('Carregando…')).toBeInTheDocument()
  })

  it('erro mostra estado de erro com retry', async () => {
    comPagina({ isError: true })
    renderizar()
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('vazio SEM filtro é "não configurado", com a consequência de negócio', () => {
    comPagina({ items: [] })
    renderizar()
    const regiao = screen.getByRole('status')
    expect(regiao).toHaveTextContent('Nenhum feriado configurado em "Padrão"')
    expect(regiao).toHaveTextContent('dia cheio no cálculo do tempo em horário comercial')
    expect(screen.queryByText(/nenhum resultado encontrado/i)).not.toBeInTheDocument()
  })

  /** QA `D-2` — mesma medição do vazio da página, na classe que o DOM de fato tem. */
  it('D-2: o vazio não herda o `text-primary/30` do EmptyState compartilhado', () => {
    comPagina({ items: [] })
    renderizar()
    const titulo = screen.getByText('Nenhum feriado configurado em "Padrão"')
    const corpo = screen.getByText(/dia cheio no cálculo/)

    expect(titulo.className).toContain('text-foreground')
    expect(corpo.className).toContain('text-foreground/70')
    for (const elemento of [titulo, corpo]) {
      expect(elemento.className).not.toContain('text-primary/30')
      expect(elemento.className).not.toContain('italic')
    }
  })

  it('vazio COM filtro de ano diz outra coisa — os dois estados não se confundem', async () => {
    comPagina({ items: [] })
    renderizar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('combobox', { name: /Ano/ }))
    await usuario.click(await screen.findByRole('option', { name: '2027' }))

    expect(await screen.findByText(/Nenhum feriado cadastrado em 2027/i)).toBeInTheDocument()
    expect(screen.queryByText(/Nenhum feriado configurado em "Padrão"/i)).not.toBeInTheDocument()
  })

  it('a lista mostra data, dia da semana (0 = domingo) e nome', () => {
    comPagina()
    renderizar()
    const linha = screen.getByText('Carnaval').closest('tr') as HTMLTableRowElement
    expect(within(linha).getByText('04/03/2026')).toBeInTheDocument()
    // 04/03/2026 é quarta-feira; um off-by-one diria terça ou quinta.
    expect(within(linha).getByText('Quarta-feira')).toBeInTheDocument()
  })

  it('sem permissão de escrita não há ações nem coluna de ações', () => {
    comPagina()
    renderizar(false)
    expect(screen.queryByRole('button', { name: 'Novo feriado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remover feriado/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Ações' })).not.toBeInTheDocument()
  })
})

describe('HolidaysSection — DD-2 na remoção', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('remover feriado PASSADO mostra A CONTAGEM DA ROTA antes de remover', async () => {
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-03-04', true, 12))
    mockRemove.mockResolvedValue({ ...feriados[0] })
    comPagina()
    renderizar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Remover feriado Carnaval' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Remover feriado em data passada')
    expect(await within(dialogo).findByText(/12 chamados já fechados/)).toBeInTheDocument()
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-03-04')
    // O numero esta na tela ANTES da remocao — e isso que DD-2 pede.
    expect(mockRemove).not.toHaveBeenCalled()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith({ calendarId: 3, holidayId: 1 }))
  })

  it('a contagem exibida acompanha a resposta da rota — nao e constante', async () => {
    // Companheira positiva com outro valor: se o texto viesse de constante, os dois testes
    // nao poderiam passar na mesma execucao.
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-03-04', true, 3))
    comPagina()
    renderizar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Remover feriado Carnaval' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(await within(dialogo).findByText(/3 chamados já fechados/)).toBeInTheDocument()
    expect(dialogo).not.toHaveTextContent('12 chamados')
  })

  it('enquanto a contagem nao chega, o confirmar fica travado e nao ha numero na tela', async () => {
    let liberar: (valor: HolidayImpactDto) => void = () => undefined
    mockGetHolidayImpact.mockImplementation(
      () =>
        new Promise<HolidayImpactDto>((resolve) => {
          liberar = resolve
        }),
    )
    comPagina()
    renderizar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Remover feriado Carnaval' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent(/Consultando quantos chamados fechados são afetados/)
    expect(dialogo).not.toHaveTextContent(/\d+ chamado/)
    expect(within(dialogo).getByRole('button', { name: 'Remover' })).toBeDisabled()

    liberar(impacto('2026-03-04', true, 2))

    expect(await within(dialogo).findByText(/2 chamados já fechados/)).toBeInTheDocument()
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Remover' })).toBeEnabled(),
    )
  })

  it('remover feriado FUTURO confirma sem falar de retroatividade e SEM consultar a rota', async () => {
    mockRemove.mockResolvedValue({ ...feriados[1] })
    comPagina()
    renderizar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Remover feriado Natal' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Remover feriado')
    expect(dialogo).not.toHaveTextContent(/indicadores já apurados/i)
    expect(mockGetHolidayImpact).not.toHaveBeenCalled()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith({ calendarId: 3, holidayId: 2 }))
    // Sem retroatividade, nenhuma contagem e exibida — nem mesmo "0".
    expect(screen.queryByText(/chamados já fechados/i)).not.toBeInTheDocument()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// QA `D-1` — a importação vista DA SEÇÃO: `calendarId` chega à rota de pré-contagem
// ─────────────────────────────────────────────────────────────────────────────

describe('HolidaysSection — importação em lote e DD-2 (D-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    comPagina()
    mockGetHolidayImpact.mockImplementation((_c: number, data: string) =>
      Promise.resolve(impacto(data, true, 42)),
    )
    mockImportar.mockResolvedValue({
      total: 1,
      criados: 1,
      atualizados: 0,
      inalterados: 0,
      dryRun: true,
    })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('confirmar o lote com data passada pergunta ANTES de gravar, com o número da rota', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Importar planilha' }))
    await usuario.upload(
      screen.getByLabelText('Escolher planilha de feriados'),
      new File(['data;nome\n2026-01-01;Ano Novo\n'], 'feriados.csv', { type: 'text/csv' }),
    )
    await screen.findByText('Ano Novo')

    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))
    await screen.findByText(/Simulação \(nada foi gravado\)/i)
    expect(mockImportar).toHaveBeenCalledTimes(1)
    expect(mockImportar.mock.calls[0][0]).toEqual({
      calendarId: 3,
      itens: [{ data: '2026-01-01', nome: 'Ano Novo' }],
      dryRun: true,
    })

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))

    const dialogo = await screen.findByRole('alertdialog')
    // O `calendarId` da SEÇÃO atravessou até a rota de pré-contagem — sem ele, a consulta
    // seria feita no calendário errado (ou nem seria feita).
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-01-01')
    expect(await within(dialogo).findByText(/42 chamados já fechados/)).toBeInTheDocument()
    // 🔴 Nada foi gravado: a segunda chamada (dryRun=false) ainda não aconteceu.
    expect(mockImportar).toHaveBeenCalledTimes(1)

    mockImportar.mockResolvedValue({
      total: 1,
      criados: 1,
      atualizados: 0,
      inalterados: 0,
      dryRun: false,
    })
    await usuario.click(screen.getByRole('button', { name: 'Importar mesmo assim' }))
    await waitFor(() => expect(mockImportar).toHaveBeenCalledTimes(2))
    expect(mockImportar.mock.calls[1][0].dryRun).toBe(false)
  })

  it('o aviso pós-importação traz os contadores e NÃO a frase incondicional sem número', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Importar planilha' }))
    await usuario.upload(
      screen.getByLabelText('Escolher planilha de feriados'),
      new File(['data;nome\n2026-12-26;Dia Extra\n'], 'feriados.csv', { type: 'text/csv' }),
    )
    await screen.findByText('Dia Extra')

    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))
    await screen.findByText(/Simulação \(nada foi gravado\)/i)

    mockImportar.mockResolvedValue({
      total: 1,
      criados: 1,
      atualizados: 0,
      inalterados: 0,
      dryRun: false,
    })
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))

    // Data futura: grava direto, sem diálogo e sem consultar a pré-contagem.
    const aviso = await screen.findByText(/Importação concluída/)
    expect(mockGetHolidayImpact).not.toHaveBeenCalled()
    expect(aviso).toHaveTextContent('1 feriado(s) novo(s)')
    // A frase antiga era incondicional e SEM número — aparecia igual sem data passada
    // nenhuma, que é pior que não avisar (QA `D-1`).
    expect(aviso).not.toHaveTextContent('recalculam os indicadores')
  })
})
