import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarFormModal } from './CalendarFormModal'
import type { CalendarDto, CalendarRequest } from '../types/calendar'

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
  calendario: CalendarDto | null,
  onSave = vi
    .fn<(c: CalendarDto | null, p: CalendarRequest) => Promise<unknown>>()
    .mockResolvedValue({}),
  totalDeCalendarios = 1,
) {
  const onClose = vi.fn()
  render(
    <CalendarFormModal
      isOpen
      calendario={calendario}
      totalDeCalendarios={totalDeCalendarios}
      onSave={onSave}
      onClose={onClose}
    />,
  )
  return { onSave, onClose }
}

describe('CalendarFormModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cria calendário mandando a meta como NÚMERO no wire (R-10)', async () => {
    const { onSave, onClose } = renderizar(null)
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText(/Nome do calendário/), '24/7')
    await usuario.click(screen.getByRole('switch', { name: 'Ignorar feriados' }))
    await usuario.type(screen.getByLabelText(/Meta padrão de 1º atendimento/), '30')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const noWire = JSON.parse(JSON.stringify(onSave.mock.calls[0][1])) as CalendarRequest
    expect(noWire).toEqual({
      nome: '24/7',
      padrao: false,
      ignorarFeriados: true,
      slaPadraoMinutos: 30,
    })
    expect(typeof noWire.slaPadraoMinutos).toBe('number')
    expect(onClose).toHaveBeenCalled()
  })

  it('meta em branco vira null — "sem meta" é estado, não erro', async () => {
    const { onSave } = renderizar(null)
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText(/Nome do calendário/), 'Padrão')
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][1].slaPadraoMinutos).toBeNull()
  })

  it('edição parte dos valores do calendário, com null virando campo vazio', () => {
    renderizar({
      id: 3,
      nome: 'Padrão',
      padrao: true,
      ignorarFeriados: false,
      slaPadraoMinutos: null,
    })
    expect(screen.getByLabelText(/Nome do calendário/)).toHaveValue('Padrão')
    expect(screen.getByLabelText(/Meta padrão de 1º atendimento/)).toHaveValue('')
    expect(screen.getByRole('switch', { name: 'Calendário padrão' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('409 CALENDAR_LAST_DEFAULT vira mensagem acionável inline, com o modal aberto', async () => {
    const onSave = vi
      .fn<(c: CalendarDto | null, p: CalendarRequest) => Promise<unknown>>()
      .mockRejectedValue(
        erroApi(409, 'CALENDAR_LAST_DEFAULT', 'Este é o último calendário padrão.'),
      )
    const { onClose } = renderizar(
      { id: 3, nome: 'Padrão', padrao: true, ignorarFeriados: false, slaPadraoMinutos: null },
      onSave,
    )
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('switch', { name: 'Calendário padrão' }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Este é o último calendário padrão.')
    expect(alerta).toHaveTextContent('Marque outro calendário como padrão')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('nome obrigatório é barrado pelo schema, sem request', async () => {
    const { onSave } = renderizar(null)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Informe o nome do calendário.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})
