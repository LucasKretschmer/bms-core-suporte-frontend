import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HolidayImpactDto, ImportHolidaysResultDto } from '../types/calendar'

const { mockGetHolidayImpact } = vi.hoisted(() => ({ mockGetHolidayImpact: vi.fn() }))

// Mock na fronteira do AXIOS (o serviço), não no hook: é isso que faz o teste provar que
// o número exibido **veio da rota de pré-contagem**, atravessando o react-query.
vi.mock('../services/businessCalendarService', () => ({
  getHolidayImpact: mockGetHolidayImpact,
  getSchedule: vi.fn(),
  listCalendars: vi.fn(),
  listHolidays: vi.fn(),
}))

import { HolidayImportModal } from './HolidayImportModal'

/**
 * A importação é o ponto onde AUTO-124-5 (parse no navegador), AUTO-124-9 (recusa total
 * com pré-visualização) e o relatório linha a linha do `422` se encontram. Estes testes
 * são de COMPONENTE porque todos os três são de **efeito**: um parser correto ligado a um
 * botão que não exige simulação passa em qualquer teste unitário.
 */

const HOJE = new Date('2026-09-06T15:00:00Z')

function arquivoCsv(conteudo: string, nome = 'feriados.csv'): File {
  return new File([conteudo], nome, { type: 'text/csv' })
}

function erro422(details: { field: string; message: string }[]): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: {
      error: {
        code: 'IMPORT_INVALID_ROWS',
        message: 'A importação foi recusada por inteiro: nenhuma linha foi gravada.',
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

const simulacaoOk: ImportHolidaysResultDto = {
  total: 2,
  criados: 2,
  atualizados: 0,
  inalterados: 0,
  dryRun: true,
}

function impacto(data: string, retroativo: boolean, tickets: number): HolidayImpactDto {
  return { data, avisoRetroativo: retroativo, ticketsFechadosNoDia: tickets }
}

function renderizar(
  onImportar = vi
    .fn<(itens: { data: string; nome: string }[], dryRun: boolean) => Promise<ImportHolidaysResultDto>>()
    .mockResolvedValue(simulacaoOk),
) {
  const onImportado = vi.fn()
  const onClose = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <HolidayImportModal
        calendarId={3}
        isOpen
        onClose={onClose}
        onImportar={onImportar}
        onImportado={onImportado}
      />
    </QueryClientProvider>,
  )
  return { onImportar, onImportado, onClose }
}

function inputDoArquivo(): HTMLInputElement {
  return screen.getByLabelText('Escolher planilha de feriados') as HTMLInputElement
}

describe('HolidayImportModal — erro de ARQUIVO, antes de qualquer request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-01-01', true, 42))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('planilha sem coluna de data é recusada com as colunas encontradas', async () => {
    const { onImportar } = renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(inputDoArquivo(), arquivoCsv('quando;titulo\n25/12/2026;Natal\n'))

    expect(await screen.findByText(/não tem coluna de data/i)).toHaveTextContent('quando, titulo')
    expect(onImportar).not.toHaveBeenCalled()
  })

  it('o seletor de arquivo só oferece os formatos que o parser lê', () => {
    renderizar()
    // A recusa de formato tem DUAS camadas: o `accept` (que o próprio navegador impõe,
    // e por isso um .pdf nem chega ao `change`) e a guarda de extensão do parser, coberta
    // em `holidayImportParser.test.ts`. Aqui se prova a primeira.
    expect(inputDoArquivo()).toHaveAttribute('accept', '.csv,.txt,.xlsx')
  })
})

describe('HolidayImportModal — pré-visualização OBRIGATÓRIA (AUTO-124-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-01-01', true, 42))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('lote 100% FUTURO: confirmar só liga depois da simulação e grava direto', async () => {
    // Datas todas posteriores a 06/09/2026 — nenhuma retroatividade envolvida, então o
    // caminho rápido continua sendo um clique só e **nenhuma** requisição de pré-contagem.
    const { onImportar, onImportado } = renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n2026-12-25;Natal\n2026-11-15;Proclamação\n'),
    )

    await screen.findByText('Natal')
    const confirmar = screen.getByRole('button', { name: 'Confirmar importação' })
    // É este assert que impede "confirmar direto": sem simulação, o botão está morto.
    expect(confirmar).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))

    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(1))
    expect(onImportar.mock.calls[0]).toEqual([
      [
        { data: '2026-12-25', nome: 'Natal' },
        { data: '2026-11-15', nome: 'Proclamação' },
      ],
      true,
    ])
    expect(await screen.findByText(/Simulação \(nada foi gravado\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeEnabled()

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(2))
    expect(onImportar.mock.calls[1][1]).toBe(false)
    expect(onImportado).toHaveBeenCalled()
    // Sem data passada não há diálogo nem requisição — companheiro negativo do bloco D-1.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockGetHolidayImpact).not.toHaveBeenCalled()
  })

  it('linha inválida bloqueia a simulação e explica a recusa TOTAL', async () => {
    const { onImportar } = renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n2026-12-25;Natal\nontem;Sem data\n'),
    )

    expect(await screen.findByText(/formato não reconhecido/i)).toBeInTheDocument()
    expect(screen.getByText(/tudo ou nada/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular importação' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled()
    expect(onImportar).not.toHaveBeenCalled()
  })

  it('a pré-visualização mostra cada linha com o número dela no arquivo', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n2026-12-25;Natal\n2026-01-01;Ano Novo\n'),
    )

    const linhaNatal = (await screen.findByText('Natal')).closest('tr')
    expect(linhaNatal).not.toBeNull()
    expect(within(linhaNatal as HTMLTableRowElement).getByText('2')).toBeInTheDocument()
    expect(
      within(linhaNatal as HTMLTableRowElement).getByText('25 de dezembro de 2026'),
    ).toBeInTheDocument()
  })
})

describe('HolidayImportModal — ambiguidade DD/MM × MM/DD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-01-01', true, 42))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('sem escolha, a importação fica bloqueada e a linha diz por quê', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(inputDoArquivo(), arquivoCsv('data;nome\n03/04/2026;Feriado\n'))

    expect(await screen.findByText(/Escolha DD\/MM ou MM\/DD/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular importação' })).toBeDisabled()
  })

  it('a escolha muda a interpretação POR EXTENSO e libera a simulação', async () => {
    const { onImportar } = renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(inputDoArquivo(), arquivoCsv('data;nome\n03/04/2026;Feriado\n'))
    await screen.findByText('Feriado')

    await usuario.click(screen.getByLabelText('DD/MM/AAAA (dia primeiro)'))
    expect(await screen.findByText('3 de abril de 2026')).toBeInTheDocument()

    await usuario.click(screen.getByLabelText('MM/DD/AAAA (mês primeiro)'))
    expect(await screen.findByText('4 de março de 2026')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))
    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(1))
    expect(onImportar.mock.calls[0][0]).toEqual([{ data: '2026-03-04', nome: 'Feriado' }])
  })

  it('trocar a ordem depois de simular DESLIGA o confirmar — os itens mudaram', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(inputDoArquivo(), arquivoCsv('data;nome\n03/04/2026;Feriado\n'))
    await screen.findByText('Feriado')
    await usuario.click(screen.getByLabelText('DD/MM/AAAA (dia primeiro)'))
    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))
    await screen.findByText(/Simulação \(nada foi gravado\)/i)
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeEnabled()

    await usuario.click(screen.getByLabelText('MM/DD/AAAA (mês primeiro)'))

    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled()
    expect(screen.queryByText(/Simulação \(nada foi gravado\)/i)).not.toBeInTheDocument()
  })
})

describe('HolidayImportModal — o 422 do servidor chega LINHA A LINHA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-01-01', true, 42))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('cada details[] vira uma linha do relatório, com o número da linha do ARQUIVO', async () => {
    const onImportar = vi
      .fn<(itens: { data: string; nome: string }[], dryRun: boolean) => Promise<ImportHolidaysResultDto>>()
      .mockRejectedValue(erro422([{ field: 'itens[1].nome', message: 'O nome do feriado é obrigatório.' }]))
    renderizar(onImportar)
    const usuario = userEvent.setup()

    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n2026-12-25;Natal\n2026-01-01;Ano Novo\n'),
    )
    await screen.findByText('Ano Novo')
    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))

    // A mensagem geral aparece...
    expect(
      await screen.findByText(/recusada por inteiro/i),
    ).toBeInTheDocument()
    // ...e, principalmente, o detalhe da linha: itens[1] é a linha 3 do arquivo.
    expect(screen.getByText(/Linha 3 \(nome\): O nome do feriado é obrigatório\./)).toBeInTheDocument()
    // Um toast genérico não teria como dizer isto — é o que o enunciado proíbe.
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled()
  })
})


/**
 * QA `D-1` — o caminho que grava até 500 datas de uma vez tem de pagar a MESMA guarda de
 * DD-2 que o cadastro de um feriado paga. Testes de COMPONENTE, porque o sujeito da frase
 * é *o botão que grava*: uma função pura correta ligada a um botão que ignora o diálogo
 * passa em qualquer teste unitário (`rules/tests.md`).
 */
describe('HolidayImportModal — DD-2 no LOTE (D-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockImplementation((_c: number, data: string) =>
      Promise.resolve(impacto(data, true, data === '2026-01-01' ? 42 : 7)),
    )
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  /** Sobe o CSV do QA (duas datas passadas + uma futura) e simula. */
  // Tipo derivado do próprio `renderizar` — `ReturnType<typeof vi.fn>` é `Mock<Procedure |
  // Constructable>` e não casa com a assinatura esperada (QA `N-3`).
  async function ateASimulacao(onImportar?: Parameters<typeof renderizar>[0]) {
    const contexto = onImportar === undefined ? renderizar() : renderizar(onImportar)
    const usuario = userEvent.setup()
    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n2026-01-01;Ano Novo\n2026-04-21;Tiradentes\n2026-12-25;Natal\n'),
    )
    await screen.findByText('Ano Novo')
    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))
    await screen.findByText(/Simulação \(nada foi gravado\)/i)
    return { ...contexto, usuario }
  }

  it('confirmar com data passada NÃO grava: abre a confirmação COM a contagem antes', async () => {
    const { onImportar, usuario } = await ateASimulacao()
    expect(onImportar).toHaveBeenCalledTimes(1) // só o dryRun

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))

    const dialogo = await screen.findByRole('alertdialog')
    // A pré-contagem foi consultada — uma requisição por data PASSADA, e só por elas.
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-01-01')
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-04-21')
    expect(mockGetHolidayImpact).not.toHaveBeenCalledWith(3, '2026-12-25')

    expect(await within(dialogo).findByText(/49 chamados já fechados/)).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('01/01/2026, 21/04/2026')
    expect(dialogo).toHaveTextContent('2 datas de hoje ou anteriores')
    // 🔴 O ponto de D-1: NADA foi gravado até aqui.
    expect(onImportar).toHaveBeenCalledTimes(1)

    await usuario.click(screen.getByRole('button', { name: 'Importar mesmo assim' }))
    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(2))
    expect(onImportar.mock.calls[1][1]).toBe(false)
  })

  it('o número vem DA ROTA — outro valor, outro texto (companheira do teste acima)', async () => {
    mockGetHolidayImpact.mockImplementation((_c: number, data: string) =>
      Promise.resolve(impacto(data, true, 5)),
    )
    const { usuario } = await ateASimulacao()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(await within(dialogo).findByText(/10 chamados já fechados/)).toBeInTheDocument()
    expect(dialogo).not.toHaveTextContent('49 chamados')
  })

  it('cancelar a confirmação não grava nada', async () => {
    const { onImportar, usuario } = await ateASimulacao()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    await screen.findByRole('alertdialog')

    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(onImportar).toHaveBeenCalledTimes(1)
  })

  it('confirmar fica TRAVADO enquanto a contagem não chega — "ainda não sei" ≠ "nenhum"', async () => {
    // Uma promessa pendente POR DATA: guardar só o último resolver deixaria a primeira
    // consulta pendente para sempre e o teste passaria pelo motivo errado.
    const liberadores: ((valor: HolidayImpactDto) => void)[] = []
    mockGetHolidayImpact.mockImplementation(
      (_c: number, data: string) =>
        new Promise<HolidayImpactDto>((resolve) => {
          liberadores.push(() => resolve(impacto(data, true, 3)))
        }),
    )

    const { onImportar, usuario } = await ateASimulacao()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Consultando quantos chamados fechados são afetados')
    const confirmar = within(dialogo).getByRole('button', { name: 'Importar mesmo assim' })
    expect(confirmar).toBeDisabled()
    // Nenhum número de chamado na tela enquanto a consulta não volta — nem 0.
    expect(dialogo.textContent).not.toMatch(/\d+ chamados? já fechados?/)

    // Companheira positiva NA MESMA execução: quando as respostas chegam, o botão libera.
    expect(liberadores).toHaveLength(2)
    for (const liberar of liberadores) liberar(impacto('2026-01-01', true, 3))
    await waitFor(() =>
      expect(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Importar mesmo assim' }),
      ).toBeEnabled(),
    )
    expect(onImportar).toHaveBeenCalledTimes(1)
  })

  it('a pré-visualização já avisa quantas datas são retroativas, antes de qualquer clique', async () => {
    // 124/`P-6` — travava "…são anteriores a hoje". Reescrito: a contagem passou a incluir
    // hoje, e a frase antiga deixaria de descrever o que o número conta.
    await ateASimulacao()
    const aviso = screen.getByText(/2 datas deste arquivo são de hoje ou anteriores/)
    expect(aviso).toBeInTheDocument()
    expect(aviso.closest('p')).toHaveTextContent('01/01/2026, 21/04/2026')
  })

  /**
   * 🔴 124/`P-6` no LOTE — a fronteira também vale para a importação.
   *
   * O arquivo traz HOJE (06/09/2026) e HOJE + 1 (07/09/2026). A pré-visualização tem de
   * contar **uma** data retroativa, e a confirmação tem de consultar **só** a de hoje.
   *
   * O que faz este teste ficar vermelho: restaurar `iso < hoje` — o lote de hoje passaria
   * direto, sem diálogo e sem contagem, enquanto o servidor recalcularia os indicadores dos
   * chamados fechados hoje de manhã.
   */
  it('🔴 lote com HOJE conta como retroativo; hoje + 1 fica de fora (P-6)', async () => {
    mockGetHolidayImpact.mockImplementation((_c: number, data: string) =>
      Promise.resolve(impacto(data, true, 9)),
    )
    const { onImportar } = renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n2026-09-06;Hoje\n2026-09-07;Amanha\n'),
    )
    await screen.findByText('Hoje')
    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))
    await screen.findByText(/Simulação \(nada foi gravado\)/i)

    // Cardinalidade ASSIMÉTRICA de propósito (1 de 2 linhas): inverter o predicado daria 1
    // também, mas apontaria a OUTRA data — por isso a data aparece por extenso ao lado.
    const aviso = screen.getByText(/1 data deste arquivo é de hoje ou anterior/)
    expect(aviso.closest('p')).toHaveTextContent('06/09/2026')
    expect(aviso.closest('p')).not.toHaveTextContent('07/09/2026')

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    const dialogo = await screen.findByRole('alertdialog')

    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-09-06')
    expect(mockGetHolidayImpact).not.toHaveBeenCalledWith(3, '2026-09-07')
    expect(await within(dialogo).findByText(/9 chamados já fechados/)).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('Importar 1 feriado em data de hoje ou anterior')
    // Nada gravado antes da decisão: só o dryRun aconteceu.
    expect(onImportar).toHaveBeenCalledTimes(1)
  })

  it('erro na pré-contagem NÃO trava a confirmação, e diz que não conseguiu consultar', async () => {
    mockGetHolidayImpact.mockRejectedValue(erro422([]))
    const { onImportar, usuario } = await ateASimulacao()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))

    const dialogo = await screen.findByRole('alertdialog')
    await waitFor(() =>
      expect(dialogo).toHaveTextContent('Não foi possível consultar quantos chamados são afetados'),
    )
    const confirmar = within(dialogo).getByRole('button', { name: 'Importar mesmo assim' })
    expect(confirmar).toBeEnabled()

    await usuario.click(confirmar)
    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(2))
  })
})

/**
 * QA `D-5` — CSV do Excel pt-BR (Windows-1252). O nome chegava corrompido e a linha vinha
 * marcada "Pronta": gravar lixo é pior que recusar.
 */
describe('HolidayImportModal — codificação do arquivo (D-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-01-01', true, 42))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  /** `2026-11-15;Proclamação da República` gravado em Windows-1252. */
  function csvLatin1(): File {
    const latin1 = (t: string): number[] => [...t].map((c) => c.charCodeAt(0))
    const bytes = new Uint8Array([
      ...latin1('data;nome\n2026-11-15;Proclama'),
      0xe7,
      0xe3,
      ...latin1('o da Rep'),
      0xfa,
      ...latin1('blica\n'),
    ])
    return new File([bytes], 'feriados.csv', { type: 'text/csv' })
  }

  it('o arquivo é recusado na tela, e nada fica marcado "Pronta"', async () => {
    const { onImportar } = renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(inputDoArquivo(), csvLatin1())

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('UTF-8')
    expect(alerta).toHaveTextContent('.xlsx')
    expect(screen.queryByText('Pronta')).not.toBeInTheDocument()
    expect(screen.queryByText(/Proclama/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular importação' })).toBeDisabled()
    expect(onImportar).not.toHaveBeenCalled()
  })

  it('companheira positiva: o MESMO nome em UTF-8 chega íntegro e fica "Pronta"', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n2026-11-15;Proclamação da República\n'),
    )

    expect(await screen.findByText('Proclamação da República')).toBeInTheDocument()
    expect(screen.getByText('Pronta')).toBeInTheDocument()
  })
})

/** QA `D-6` e `D-7` — a tela não afirma o que não é, e não decide pelo usuário. */
describe('HolidayImportModal — data impossível e ordem exigida (D-6, D-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockResolvedValue(impacto('2026-01-01', true, 42))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  it('D-6: 31/13/2026 aparece como INEXISTENTE, sem a frase falsa de ambiguidade', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(inputDoArquivo(), arquivoCsv('data;nome\n31/13/2026;Nada\n'))

    expect(await screen.findByText(/Data inexistente/)).toHaveTextContent('31/13/2026')
    expect(screen.queryByText(/pode ser dia\/mês ou mês\/dia/)).not.toBeInTheDocument()
    // E o seletor de ordem não é imposto por uma data que nenhuma ordem salva.
    expect(screen.queryByText('Como ler as datas com barra')).not.toBeInTheDocument()
  })

  it('D-6 companheira positiva: 03/04/2026 CONTINUA pedindo a escolha, com a frase certa', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(inputDoArquivo(), arquivoCsv('data;nome\n03/04/2026;Feriado\n'))

    expect(await screen.findByText(/pode ser dia\/mês ou mês\/dia/)).toBeInTheDocument()
    expect(screen.getByText('Como ler as datas com barra')).toBeInTheDocument()
  })

  it('D-7: com ambiguidade, nada vem pré-selecionado e a simulação nasce BLOQUEADA', async () => {
    renderizar()
    const usuario = userEvent.setup()

    // `25/12/2026` força DD/MM e `03/04/2026` é ambígua: antes, a ordem era inferida e
    // "Simular" já nascia habilitado — o usuário nunca escolhia nada.
    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n25/12/2026;Natal\n03/04/2026;Outro\n'),
    )

    await screen.findByText('Natal')
    const dmy = screen.getByLabelText('DD/MM/AAAA (dia primeiro)') as HTMLInputElement
    const mdy = screen.getByLabelText('MM/DD/AAAA (mês primeiro)') as HTMLInputElement
    expect(dmy.checked).toBe(false)
    expect(mdy.checked).toBe(false)
    expect(screen.getByRole('button', { name: 'Simular importação' })).toBeDisabled()

    // E, principalmente: NENHUMA linha foi interpretada por inferência. A coluna "Interpretada
    // como" está vazia nas duas — é este assert que pega o parser resolvendo por palpite,
    // mesmo com a tela travada.
    const linhaAmbigua = screen.getByText('03/04/2026').closest('tr') as HTMLTableRowElement
    const linhaForcada = screen.getByText('25/12/2026').closest('tr') as HTMLTableRowElement
    expect(within(linhaAmbigua).getByText('—')).toBeInTheDocument()
    expect(within(linhaForcada).getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('3 de abril de 2026')).not.toBeInTheDocument()

    // Companheira positiva na mesma execução: com a escolha feita, interpreta e libera.
    await usuario.click(dmy)
    expect(await screen.findByText('3 de abril de 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular importação' })).toBeEnabled()
  })

  it('D-7: SEM ambiguidade o seletor nem aparece — não há nada a decidir', async () => {
    renderizar()
    const usuario = userEvent.setup()

    await usuario.upload(inputDoArquivo(), arquivoCsv('data;nome\n25/12/2026;Natal\n'))

    expect(await screen.findByText('25 de dezembro de 2026')).toBeInTheDocument()
    expect(screen.queryByText('Como ler as datas com barra')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular importação' })).toBeEnabled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// QA `N-2` — o TETO de consultas, provado NA TELA (não só na função)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A mutação `R2-TETO-SEM-PISO` do QA (remover o `slice(0, MAX_DATAS_CONSULTADAS_NO_LOTE)`)
 * derrubava **1 teste unitário e nenhum de componente**: nada afirmava que o modal para em
 * 30 requisições, nem que o texto de piso chega à tela. O teste do texto recebia `impactos`
 * montados à mão — ele não passava pela fiação que o teto governa.
 *
 * `rules/tests.md` § "o sujeito da frase decide o tipo de teste": aqui o sujeito é **a tela**.
 */
describe('HolidayImportModal — teto de consultas do lote (N-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  /** `quantidade` datas consecutivas a partir de 01/01/2026 — todas PASSADAS em 06/09/2026. */
  function csvComDatasPassadas(quantidade: number): File {
    const linhas = Array.from({ length: quantidade }, (_, i) => {
      const dia = new Date(Date.UTC(2026, 0, 1 + i))
      const iso = dia.toISOString().slice(0, 10)
      return `${iso};Feriado ${i + 1}`
    })
    return arquivoCsv(`data;nome\n${linhas.join('\n')}\n`)
  }

  async function ateOdialogo(quantidade: number) {
    const contexto = renderizar()
    const usuario = userEvent.setup()
    await usuario.upload(inputDoArquivo(), csvComDatasPassadas(quantidade))
    await screen.findByText(`Feriado ${quantidade}`)
    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))
    await screen.findByText(/Simulação \(nada foi gravado\)/i)
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    return { ...contexto, usuario, dialogo: await screen.findByRole('alertdialog') }
  }

  it('40 datas passadas ⇒ exatamente 30 requisições, e o texto diz que o número é PISO', async () => {
    // Contagens ASSIMÉTRICAS: 100 na primeira data e 1 nas demais. A soma das 30
    // consultadas é 129 — um número que só existe se a fiação parar em 30. Sem o teto,
    // seriam 139 (as 40) e nenhum destes asserts sobrevive.
    mockGetHolidayImpact.mockImplementation((_c: number, data: string) =>
      Promise.resolve(impacto(data, true, data === '2026-01-01' ? 100 : 1)),
    )

    const { dialogo } = await ateOdialogo(40)

    await waitFor(() => expect(mockGetHolidayImpact).toHaveBeenCalledTimes(30))
    // Identidade, não só cardinalidade: a 30ª data foi consultada e a 31ª não.
    expect(mockGetHolidayImpact).toHaveBeenCalledWith(3, '2026-01-30')
    expect(mockGetHolidayImpact).not.toHaveBeenCalledWith(3, '2026-01-31')
    expect(mockGetHolidayImpact).not.toHaveBeenCalledWith(3, '2026-02-09')

    // A quantidade de datas passadas NÃO é truncada (é local, sem rede).
    expect(dialogo).toHaveTextContent('40 datas de hoje ou anteriores')
    // ...e o número de chamados é declarado como PISO, com o teto dito por extenso.
    expect(await within(dialogo).findByText(/Nas 30 primeiras dessas datas/)).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('129 chamados já fechados')
    expect(dialogo).toHaveTextContent('as outras 10 não foram consultadas')
    expect(dialogo).toHaveTextContent('o efeito real é maior')
    // Companheiro negativo: a tela não afirma um total fechado.
    expect(dialogo).not.toHaveTextContent('Ao todo')
  })

  it('lote abaixo do teto ⇒ todas consultadas e o total é afirmado (companheira positiva)', async () => {
    mockGetHolidayImpact.mockImplementation((_c: number, data: string) =>
      Promise.resolve(impacto(data, true, data === '2026-01-01' ? 100 : 1)),
    )

    const { dialogo } = await ateOdialogo(12)

    await waitFor(() => expect(mockGetHolidayImpact).toHaveBeenCalledTimes(12))
    expect(dialogo).toHaveTextContent('12 datas de hoje ou anteriores')
    expect(await within(dialogo).findByText(/Ao todo, 111 chamados já fechados/)).toBeInTheDocument()
    // Sem truncamento, nenhuma das frases de piso aparece.
    expect(dialogo).not.toHaveTextContent('não foram consultadas')
    expect(dialogo).not.toHaveTextContent('o efeito real é maior')
  })

  it('a lista de datas do diálogo corta em 10 e diz quantas sobraram', async () => {
    mockGetHolidayImpact.mockImplementation((_c: number, data: string) =>
      Promise.resolve(impacto(data, true, 1)),
    )

    const { dialogo } = await ateOdialogo(40)

    expect(dialogo).toHaveTextContent('01/01/2026')
    expect(dialogo).toHaveTextContent('10/01/2026')
    expect(dialogo).toHaveTextContent('e mais 30')
    // O corte é real: a 11ª data não está escrita.
    expect(dialogo).not.toHaveTextContent('11/01/2026')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// QA `N-4` — `Escape` na confirmação volta para o modal, não para fora dele
// ─────────────────────────────────────────────────────────────────────────────

describe('HolidayImportModal — Escape no alertdialog (N-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHolidayImpact.mockImplementation((_c: number, data: string) =>
      Promise.resolve(impacto(data, true, 42)),
    )
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(HOJE)
  })
  afterEach(() => vi.useRealTimers())

  async function ateOdialogoDeUmaData() {
    const contexto = renderizar()
    const usuario = userEvent.setup()
    await usuario.upload(
      inputDoArquivo(),
      arquivoCsv('data;nome\n2026-01-01;Ano Novo\n'),
    )
    await screen.findByText('Ano Novo')
    await usuario.click(screen.getByRole('button', { name: 'Simular importação' }))
    await screen.findByText(/Simulação \(nada foi gravado\)/i)
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    await screen.findByRole('alertdialog')
    return { ...contexto, usuario }
  }

  it('Escape fecha SÓ a confirmação — arquivo, pré-visualização e simulação continuam lá', async () => {
    const { usuario, onClose, onImportar } = await ateOdialogoDeUmaData()

    await usuario.keyboard('{Escape}')

    // A confirmação some...
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // ...e o modal de importação CONTINUA aberto, com o trabalho do usuário intacto.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Ano Novo')).toBeInTheDocument()
    expect(screen.getByText(/Simulação \(nada foi gravado\)/i)).toBeInTheDocument()
    expect(screen.getByText(/1 data deste arquivo é de hoje ou anterior/)).toBeInTheDocument()
    // O `onClose` do modal NÃO foi chamado: não é só "parece aberto", ninguém pediu para fechar.
    expect(onClose).not.toHaveBeenCalled()
    // E nada foi gravado.
    expect(onImportar).toHaveBeenCalledTimes(1)
  })

  it('depois do Escape dá para confirmar de novo, sem refazer nada', async () => {
    // Companheira positiva: prova que o retorno ao modal é funcional, não só visual.
    const { usuario, onImportar } = await ateOdialogoDeUmaData()
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(await within(dialogo).findByText(/42 chamados já fechados/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Importar mesmo assim' }))
    await waitFor(() => expect(onImportar).toHaveBeenCalledTimes(2))
  })

  it('Escape no modal de importação (sem confirmação aberta) continua fechando o modal', async () => {
    // Controle negativo do listener de captura: ele só age enquanto a confirmação está
    // aberta. Sem este par, "Escape não fecha nada" passaria pelos dois testes acima.
    const { onClose } = renderizar()
    const usuario = userEvent.setup()
    await usuario.upload(inputDoArquivo(), arquivoCsv('data;nome\n2026-12-25;Natal\n'))
    await screen.findByText('Natal')

    await usuario.keyboard('{Escape}')

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
