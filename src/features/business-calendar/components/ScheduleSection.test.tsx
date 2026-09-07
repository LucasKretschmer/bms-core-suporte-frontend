import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduleSection } from './ScheduleSection'
import { razaoDoTexto, reprovacoesAA, varrer } from '../../../test/medidor-de-contraste'
import type { CreateScheduleRequest, ScheduleDto } from '../types/calendar'

/**
 * Testes de COMPONENTE do expediente. Eles existem porque as invariantes desta unidade
 * (R-6 `0 = domingo`, A-3 minuto `0..1440`, DD-5 meia-noite) são de **efeito**: uma função
 * pura correta com a grade ligada ao dia errado passa em todo teste unitário.
 */

const vazio: ScheduleDto = { vigente: null, versoes: [] }

const comVigencia: ScheduleDto = {
  vigente: {
    id: 9,
    vigenciaInicio: '2026-09-01',
    janelas: [
      { diaSemana: 0, inicioMinuto: 0, fimMinuto: 1440 },
      { diaSemana: 1, inicioMinuto: 480, fimMinuto: 720 },
      { diaSemana: 1, inicioMinuto: 780, fimMinuto: 1080 },
      { diaSemana: 6, inicioMinuto: 480, fimMinuto: 720 },
    ],
  },
  versoes: [
    { id: 9, vigenciaInicio: '2026-09-01', janelasCount: 4 },
    { id: 4, vigenciaInicio: '2026-01-01', janelasCount: 5 },
  ],
}

function erro422(details: { field: string; message: string }[]): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: {
      error: {
        code: 'SCHEDULE_WINDOW_OVERLAP',
        message: 'O expediente não pôde ser salvo.',
        details,
      },
    },
    status: 422,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError('Request failed with status code 422', undefined, config, {}, response)
}

function renderizar(overrides: Partial<Parameters<typeof ScheduleSection>[0]> = {}) {
  const onSalvar = vi.fn<(p: CreateScheduleRequest) => Promise<unknown>>().mockResolvedValue({})
  render(
    <ScheduleSection
      calendarId={3}
      schedule={comVigencia}
      isLoading={false}
      isError={false}
      onRetry={vi.fn()}
      podeEditar
      onSalvar={onSalvar}
      {...overrides}
    />,
  )
  return { onSalvar }
}

describe('ScheduleSection — estados', () => {
  beforeEach(() => vi.clearAllMocks())

  /**
   * QA 124 `D-2`, **invertido** por 125/FE-A11Y-1. O teste antigo travava a AUSÊNCIA
   * temporária do `EmptyState` compartilhado (a mensagem dele media 1,84:1). O
   * componente foi corrigido, o contorno local saiu, e o teste passa a afirmar o
   * requisito: o vazio USA o componente compartilhado e o texto que o usuário lê
   * atende AA — medido no DOM, não na classe que a tela pretendia usar.
   */
  it('D-2: o vazio do expediente usa o `EmptyState` compartilhado e atende AA no DOM', () => {
    renderizar({ schedule: undefined })
    const regiao = screen.getByRole('status')
    expect(regiao).toHaveTextContent('Selecione um calendário para ver o expediente.')

    const { medidas, pulados } = varrer(regiao)
    expect(pulados).toEqual([])
    expect(reprovacoesAA(medidas)).toEqual([])
    // Literal escrito à mão (não derivado da resposta): `text-foreground` sobre
    // `--color-card`. Se a mensagem voltar para o `<p>` do DS, cai para 1,84.
    expect(razaoDoTexto(medidas, 'Selecione um calendário').toFixed(2)).toBe('13.82')
    expect(regiao.innerHTML).not.toContain('text-primary/30')
  })

  it('carregando mostra skeleton', () => {
    renderizar({ isLoading: true })
    expect(screen.getByLabelText('Carregando…')).toBeInTheDocument()
  })

  it('erro mostra estado de erro com retry', async () => {
    const onRetry = vi.fn()
    renderizar({ isError: true, onRetry })
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('sem vigência: "não configurado" com a consequência, nunca "nenhum resultado"', () => {
    renderizar({ schedule: vazio })
    const aviso = screen.getByText(/Expediente não configurado/i).closest('p')
    expect(aviso).toBeInTheDocument()
    expect(aviso?.textContent).toContain('SLA de 1º atendimento continua sem apuração')
    expect(screen.queryByText(/nenhum resultado/i)).not.toBeInTheDocument()
  })
})

describe('ScheduleSection — R-6: a grade começa no DOMINGO e não traduz o dia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('as sete linhas aparecem na ordem do valor (0..6)', () => {
    renderizar()
    const titulos = screen
      .getAllByRole('heading', { level: 3 })
      .filter((h) => h.id.startsWith('expediente-dia-'))
      .map((h) => h.textContent)
    expect(titulos).toEqual([
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ])
  })

  it('a janela com diaSemana=1 aparece em SEGUNDA-FEIRA, não em terça nem em domingo', () => {
    renderizar()
    // A-3: a janela 0..1440 do domingo é renderizada como 00:00–24:00.
    expect(screen.getByLabelText('Início da janela 1 de Domingo')).toHaveValue('00:00')
    expect(screen.getByLabelText('Fim da janela 1 de Domingo')).toHaveValue('24:00')
    // A-4: segunda-feira tem DUAS janelas (o almoço).
    expect(screen.getByLabelText('Início da janela 1 de Segunda-feira')).toHaveValue('08:00')
    expect(screen.getByLabelText('Início da janela 2 de Segunda-feira')).toHaveValue('13:00')
    expect(screen.queryByLabelText('Início da janela 1 de Terça-feira')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Início da janela 1 de Sábado')).toHaveValue('08:00')
  })

  it('salvar envia diaSemana=1 para segunda-feira, com minutos NUMÉRICOS', async () => {
    const { onSalvar } = renderizar({ schedule: vazio })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByLabelText('Adicionar janela em Segunda-feira'))
    await usuario.type(screen.getByLabelText('Início da janela 1 de Segunda-feira'), '08:00')
    await usuario.type(screen.getByLabelText('Fim da janela 1 de Segunda-feira'), '18:00')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova vigência' }))

    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1))
    const payload = onSalvar.mock.calls[0][0]
    const noWire = JSON.parse(JSON.stringify(payload)) as CreateScheduleRequest
    expect(noWire.janelas).toEqual([{ diaSemana: 1, inicioMinuto: 480, fimMinuto: 1080 }])
  })

  it('o dia inteiro do domingo viaja como 0..1440 — nunca 0..0', async () => {
    const { onSalvar } = renderizar({ schedule: vazio })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByLabelText('Adicionar janela em Domingo'))
    await usuario.type(screen.getByLabelText('Início da janela 1 de Domingo'), '00:00')
    await usuario.type(screen.getByLabelText('Fim da janela 1 de Domingo'), '24:00')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova vigência' }))

    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1))
    expect(onSalvar.mock.calls[0][0].janelas).toEqual([
      { diaSemana: 0, inicioMinuto: 0, fimMinuto: 1440 },
    ])
  })
})

describe('ScheduleSection — DD-5: a meia-noite não é atravessada', () => {
  beforeEach(() => vi.clearAllMocks())

  it('22:00 às 02:00 é recusado ANTES do request, com a instrução das duas janelas', async () => {
    const { onSalvar } = renderizar({ schedule: vazio })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByLabelText('Adicionar janela em Terça-feira'))
    await usuario.type(screen.getByLabelText('Início da janela 1 de Terça-feira'), '22:00')
    await usuario.type(screen.getByLabelText('Fim da janela 1 de Terça-feira'), '02:00')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova vigência' }))

    expect(onSalvar).not.toHaveBeenCalled()
    expect(
      await screen.findByText(/Um turno que atravessa a meia-noite se cadastra como duas janelas/i),
    ).toBeInTheDocument()
  })

  it('sobreposição no mesmo dia é recusada antes do request', async () => {
    const { onSalvar } = renderizar({ schedule: vazio })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByLabelText('Adicionar janela em Quarta-feira'))
    await usuario.type(screen.getByLabelText('Início da janela 1 de Quarta-feira'), '08:00')
    await usuario.type(screen.getByLabelText('Fim da janela 1 de Quarta-feira'), '13:00')
    await usuario.click(screen.getByLabelText('Adicionar janela em Quarta-feira'))
    await usuario.type(screen.getByLabelText('Início da janela 2 de Quarta-feira'), '12:00')
    await usuario.type(screen.getByLabelText('Fim da janela 2 de Quarta-feira'), '18:00')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova vigência' }))

    expect(onSalvar).not.toHaveBeenCalled()
    expect(await screen.findByText(/se sobrepõe a outra de Quarta-feira/i)).toBeInTheDocument()
  })
})

describe('ScheduleSection — vigência e erro do servidor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('diz por escrito que salvar cria uma versão e não reescreve o passado (A-5)', () => {
    renderizar()
    expect(screen.getByText(/não altera/i).closest('p')?.textContent).toContain(
      'continuam valendo para os dias já passados',
    )
    expect(screen.getByLabelText(/Em vigor a partir de/)).toBeInTheDocument()
  })

  it('lista as versões, marcando a que vigora hoje', () => {
    renderizar()
    const secao = screen.getByRole('region', { name: 'Versões do expediente' })
    expect(within(secao).getByText('2026-09-01').closest('li')?.textContent).toContain(
      'em vigor hoje',
    )
    expect(within(secao).getByText('2026-01-01').closest('li')?.textContent).not.toContain(
      'em vigor hoje',
    )
  })

  it('o 422 do servidor aparece LINHA A LINHA, traduzido para dia e horário', async () => {
    const onSalvar = vi
      .fn<(p: CreateScheduleRequest) => Promise<unknown>>()
      .mockRejectedValue(
        erro422([{ field: 'janelas[0].fimMinuto', message: 'O fim deve ser maior que o início.' }]),
      )
    render(
      <ScheduleSection
        calendarId={3}
        schedule={vazio}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        podeEditar
        onSalvar={onSalvar}
      />,
    )
    const usuario = userEvent.setup()

    await usuario.click(screen.getByLabelText('Adicionar janela em Sexta-feira'))
    await usuario.type(screen.getByLabelText('Início da janela 1 de Sexta-feira'), '08:00')
    await usuario.type(screen.getByLabelText('Fim da janela 1 de Sexta-feira'), '18:00')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova vigência' }))

    expect(await screen.findByText('O expediente não pôde ser salvo.')).toBeInTheDocument()
    expect(screen.getByText('Sexta-feira, 08:00–18:00 (fim):')).toBeInTheDocument()
    expect(screen.getByText(/O fim deve ser maior que o início\./)).toBeInTheDocument()
  })

  it('sem permissão de escrita não há como editar nem salvar', () => {
    renderizar({ podeEditar: false })
    expect(screen.queryByRole('button', { name: 'Salvar nova vigência' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Adicionar janela em Domingo')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Início da janela 1 de Domingo')).toBeDisabled()
  })
})
