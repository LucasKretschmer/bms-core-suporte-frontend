import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HolidayDto, HolidayImpactDto, HolidayRequest } from '../types/calendar'

const { mockGetHolidayImpact } = vi.hoisted(() => ({ mockGetHolidayImpact: vi.fn() }))

// Mock no nível do SERVIÇO (a fronteira com o axios), e não do hook: é isto que faz o teste
// provar que o número exibido **veio da rota**, atravessando o react-query, e não de uma
// constante do componente nem da resposta da escrita.
vi.mock('../services/businessCalendarService', () => ({
  getHolidayImpact: mockGetHolidayImpact,
  getSchedule: vi.fn(),
  listCalendars: vi.fn(),
  listHolidays: vi.fn(),
}))

import { HolidayFormModal } from './HolidayFormModal'

/**
 * DD-2 na tela: mexer em feriado de data passada muda indicador já apurado, e a confirmação
 * mostra **a contagem real, antes** da escrita — vinda de
 * `GET /api/v1/calendars/{cid}/holidays/impacto?data=` (§1.4 do `be-f2f3-report.md`).
 */

const HOJE = new Date('2026-09-06T15:00:00Z') // 06/09/2026, 12:00 em São Paulo

function impacto(data: string, retroativo: boolean, tickets: number): HolidayImpactDto {
  return { data, avisoRetroativo: retroativo, ticketsFechadosNoDia: tickets }
}

function erroApi(status: number, code: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code, message } },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

function renderizar(
  feriado: HolidayDto | null,
  onSave = vi
    .fn<(f: HolidayDto | null, p: HolidayRequest) => Promise<unknown>>()
    .mockResolvedValue({}),
) {
  const onClose = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <HolidayFormModal
        isOpen
        calendarId={3}
        feriado={feriado}
        onSave={onSave}
        onClose={onClose}
      />
    </QueryClientProvider>,
  )
  return { onSave, onClose }
}

async function preencher(data: string, nome: string) {
  const usuario = userEvent.setup()
  await usuario.type(screen.getByLabelText(/^\*? ?Data$/), data)
  await usuario.type(screen.getByLabelText(/Nome do feriado/), nome)
  await usuario.click(screen.getByRole('button', { name: 'Salvar' }))
  return usuario
}

describe('HolidayFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-03-04', true, 12))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('data futura salva direto, sem confirmação e SEM consultar a pré-contagem', async () => {
    const { onSave } = renderizar(null)
    await preencher('2026-12-25', 'Natal')

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][1]).toEqual({ data: '2026-12-25', nome: 'Natal' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // Caminho rápido: data futura não gera requisição nenhuma.
    expect(mockGetHolidayImpact).not.toHaveBeenCalled()
  })

  it('data PASSADA: a CONTAGEM DA ROTA aparece antes de qualquer escrita', async () => {
    const { onSave } = renderizar(null)
    const usuario = await preencher('2026-03-04', 'Carnaval')

    const dialogo = await screen.findByRole('alertdialog')
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-03-04')
    expect(await within(dialogo).findByText(/12 chamados já fechados/)).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('04/03/2026')
    expect(dialogo).toHaveTextContent(/indicadores já apurados/i)
    // O número está na tela ANTES de a escrita acontecer — é isso que DD-2 pede.
    expect(onSave).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: 'Salvar mesmo assim' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })

  it('o número é o DA ROTA, não o da resposta da escrita nem uma constante', async () => {
    // Companheira positiva do teste acima, com outro valor: se o texto viesse de constante,
    // os dois testes não poderiam passar ao mesmo tempo.
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-03-04', true, 7))
    const onSave = vi
      .fn<(f: HolidayDto | null, p: HolidayRequest) => Promise<unknown>>()
      .mockResolvedValue({ id: 1, data: '2026-03-04', nome: 'Carnaval', ticketsFechadosNoDia: 999 })
    renderizar(null, onSave)
    await preencher('2026-03-04', 'Carnaval')

    const dialogo = await screen.findByRole('alertdialog')
    expect(await within(dialogo).findByText(/7 chamados já fechados/)).toBeInTheDocument()
    expect(dialogo).not.toHaveTextContent('999')
  })

  it('enquanto a contagem não chega, nada de número e o confirmar fica travado', async () => {
    let liberar: (valor: HolidayImpactDto) => void = () => undefined
    mockGetHolidayImpact.mockImplementation(
      () => new Promise<HolidayImpactDto>((resolve) => { liberar = resolve }),
    )
    renderizar(null)
    await preencher('2026-03-04', 'Carnaval')

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent(/Consultando quantos chamados fechados são afetados/)
    // "ainda não sei" nunca pode ser exibido como "0 chamados".
    expect(dialogo).not.toHaveTextContent(/\d+ chamado/)
    expect(within(dialogo).getByRole('button', { name: 'Salvar mesmo assim' })).toBeDisabled()

    liberar(impacto('2026-03-04', true, 4))

    expect(await within(dialogo).findByText(/4 chamados já fechados/)).toBeInTheDocument()
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Salvar mesmo assim' })).toBeEnabled(),
    )
  })

  it('404 da pré-contagem: diz que NÃO CONSEGUIU consultar, sem inventar zero, e deixa seguir', async () => {
    mockGetHolidayImpact.mockRejectedValue(
      erroApi(404, 'NOT_FOUND', 'Calendário não encontrado.'),
    )
    const { onSave } = renderizar(null)
    const usuario = await preencher('2026-03-04', 'Carnaval')

    const dialogo = await screen.findByRole('alertdialog')
    expect(
      await within(dialogo).findByText(/Não foi possível consultar quantos chamados são afetados/),
    ).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('Calendário não encontrado.')
    expect(dialogo).not.toHaveTextContent(/\d+ chamado/)

    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar mesmo assim' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })

  it('422 da pré-contagem chega com a mensagem do servidor, não com toast genérico', async () => {
    mockGetHolidayImpact.mockRejectedValue(
      erroApi(422, 'VALIDATION_ERROR', 'Data deve estar no formato AAAA-MM-DD.'),
    )
    renderizar(null)
    await preencher('2026-03-04', 'Carnaval')

    const dialogo = await screen.findByRole('alertdialog')
    expect(await within(dialogo).findByText(/Data deve estar no formato AAAA-MM-DD\./)).toBeInTheDocument()
    expect(dialogo).not.toHaveTextContent('Ocorreu um erro inesperado.')
  })

  it('quando o servidor diz que a data NAO e retroativa, o zero dele nao vira "sem impacto"', async () => {
    // `ticketsFechadosNoDia` vem 0 sempre que `avisoRetroativo` e falso (inclusive hoje) —
    // ali o 0 significa "esta data nao e passado", nao "verifiquei e nao ha impacto". Quem
    // decide e o SERVIDOR; a tela so nao pode exibir esse 0 como se fosse medida.
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-03-04', false, 0))
    renderizar(null)
    await preencher('2026-03-04', 'Carnaval')

    const dialogo = await screen.findByRole('alertdialog')
    expect(
      await within(dialogo).findByText(/04\/03\/2026 não é uma data passada/),
    ).toBeInTheDocument()
    expect(dialogo).not.toHaveTextContent(/\d+ chamado/)
  })

  it('cancelar a confirmação NÃO salva', async () => {
    const { onSave } = renderizar(null)
    const usuario = await preencher('2026-03-04', 'Carnaval')

    const dialogo = await screen.findByRole('alertdialog')
    // "Cancelar" existe nos dois overlays — o do formulário e o da confirmação.
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('na EDIÇÃO, as DUAS datas passadas são consultadas e as duas contagens aparecem', async () => {
    mockGetHolidayImpact.mockImplementation(async (_cid: number, data: string) =>
      data === '2026-03-04' ? impacto(data, true, 12) : impacto(data, true, 5),
    )
    renderizar({ id: 1, data: '2026-03-04', nome: 'Carnaval' })
    const usuario = userEvent.setup()

    await usuario.clear(screen.getByLabelText(/^\*? ?Data$/))
    await usuario.type(screen.getByLabelText(/^\*? ?Data$/), '2026-01-01')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(await within(dialogo).findByText(/5 chamados já fechados/)).toBeInTheDocument()
    expect(dialogo).toHaveTextContent(/12 chamados já fechados/)
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-01-01')
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-03-04')
  })

  it('na EDIÇÃO, mover de data passada para futura também exige confirmação', async () => {
    // Só a data nova (futura) não dispararia nada — e o dia de ontem, que deixa de ser
    // feriado, é exatamente o que muda de indicador.
    const { onSave } = renderizar({ id: 1, data: '2026-03-04', nome: 'Carnaval' })
    const usuario = userEvent.setup()

    await usuario.clear(screen.getByLabelText(/^\*? ?Data$/))
    await usuario.type(screen.getByLabelText(/^\*? ?Data$/), '2026-12-25')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('04/03/2026')
    expect(mockGetHolidayImpact).toHaveBeenCalledTimes(1)
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-03-04')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('"hoje" é o dia de SÃO PAULO, não o do relógio UTC', async () => {
    // 07/09/2026 às 02:00Z ainda é 06/09 em São Paulo. Um "hoje" tirado do UTC diria
    // 07/09 e trataria o feriado de 06/09 como PASSADO, pedindo confirmação que não cabe.
    vi.setSystemTime(new Date('2026-09-07T02:00:00Z'))
    const { onSave } = renderizar(null)
    await preencher('2026-09-06', 'Hoje em SP')

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockGetHolidayImpact).not.toHaveBeenCalled()
  })

  it('mostra o dia da semana pela convenção 0 = domingo', async () => {
    renderizar(null)
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText(/^\*? ?Data$/), '2026-09-06')

    // 06/09/2026 é DOMINGO. Um `new Date('2026-09-06')` (UTC) diria sábado.
    expect(await screen.findByText(/6 de setembro de 2026 — Domingo/)).toBeInTheDocument()
  })

  it('erro do servidor na ESCRITA aparece inline e o modal continua aberto', async () => {
    const onSave = vi
      .fn<(f: HolidayDto | null, p: HolidayRequest) => Promise<unknown>>()
      .mockRejectedValue(new Error('falhou'))
    const { onClose } = renderizar(null, onSave)
    await preencher('2026-12-25', 'Natal')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('validação do schema barra data fora da faixa antes de qualquer request', async () => {
    const { onSave } = renderizar(null)
    await preencher('1900-01-01', 'Antigo')

    expect(await screen.findByText(/fora da faixa aceita/i)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    expect(mockGetHolidayImpact).not.toHaveBeenCalled()
  })
})
