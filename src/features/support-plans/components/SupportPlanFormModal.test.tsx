import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupportPlanFormModal } from './SupportPlanFormModal'
import type { CalendarOptionDto, SupportPlanDto, SupportPlanRequest } from '../types/supportPlan'
import { derivarCascataDeCssDoApp, lerTokensDeCor } from '../../../utils/cssCascade'
import { medirTextosDoDom, reprovacoesAA, temaDaCascata } from '../utils/contrasteDeTexto'

const calendarios: CalendarOptionDto[] = [
  { id: 1, nome: 'Comercial', padrao: true },
  { id: 2, nome: '24/7', padrao: false },
]

const plano: SupportPlanDto = {
  id: 7,
  nome: 'Support Pro',
  horasMes: 40,
  precoHoraExtra: 250,
  moeda: 'BRL',
  isActive: true,
  hubspotValor: null,
  slaPrimeiroAtendimentoMinutos: null,
  slaIsento: false,
  calendarioId: null,
  clientesVinculados: 14,
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

type RenderArgs = {
  plan?: SupportPlanDto | null
  hubspotValorInicial?: string
  onSave?: (plan: SupportPlanDto | null, payload: SupportPlanRequest) => Promise<unknown>
  onClose?: () => void
  calendariosStatus?: 'loading' | 'error' | 'ready'
  calendariosLista?: CalendarOptionDto[]
}

function renderModal(args: RenderArgs = {}) {
  const onSave = args.onSave ?? vi.fn().mockResolvedValue({})
  const onClose = args.onClose ?? vi.fn()
  render(
    <SupportPlanFormModal
      isOpen
      plan={args.plan ?? null}
      hubspotValorInicial={args.hubspotValorInicial}
      calendarios={args.calendariosLista ?? calendarios}
      calendariosStatus={args.calendariosStatus ?? 'ready'}
      onSave={onSave}
      onClose={onClose}
    />,
  )
  return { onSave, onClose }
}

describe('SupportPlanFormModal — criação', () => {
  beforeEach(() => vi.clearAllMocks())

  it('não renderiza nada quando fechado', () => {
    render(
      <SupportPlanFormModal
        isOpen={false}
        plan={null}
        calendarios={calendarios}
        calendariosStatus="ready"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByText('Novo plano de suporte')).toBeNull()
  })

  it('envia o payload com os tipos do wire — ids como número (R-10)', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal()

    await user.type(screen.getByLabelText(/Nome do plano/), 'Support Gold')
    await user.type(screen.getByLabelText(/Horas por mês/), '40')
    await user.type(screen.getByLabelText(/Meta de 1º atendimento/), '20')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = vi.mocked(onSave).mock.calls[0]?.[1] as SupportPlanRequest
    // O JSON serializado é o que o backend recebe — objeto em memória passaria mesmo com
    // `"20"`, porque o tipo TypeScript some em runtime.
    const wire = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
    expect(typeof wire.slaPrimeiroAtendimentoMinutos).toBe('number')
    expect(wire.slaPrimeiroAtendimentoMinutos).toBe(20)
    expect(typeof wire.horasMes).toBe('number')
    expect(wire.calendarioId).toBeNull()
    expect(wire.hubspotValor).toBeNull()
  })

  it('pré-preenche o identificador do HubSpot vindo do card de não correspondentes', () => {
    renderModal({ hubspotValorInicial: 'Support Gold' })
    expect(screen.getByLabelText(/Identificador do HubSpot/)).toHaveValue('Support Gold')
  })

  it('bloqueia o envio e mostra erro inline quando o nome está vazio', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal()

    await user.type(screen.getByLabelText(/Horas por mês/), '40')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome do plano.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('SupportPlanFormModal — isenção de SLA', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marcar "isento" limpa e desabilita a meta (estado proibido pelo CHECK do banco)', async () => {
    const user = userEvent.setup()
    renderModal()

    const meta = screen.getByLabelText(/Meta de 1º atendimento/)
    await user.type(meta, '20')
    expect(meta).toHaveValue('20')

    await user.click(screen.getByRole('switch', { name: /isento/i }))

    await waitFor(() => expect(meta).toHaveValue(''))
    expect(meta).toBeDisabled()
  })

  it('plano isento envia slaIsento=true com meta null', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal()

    await user.type(screen.getByLabelText(/Nome do plano/), 'Support 24x7')
    await user.type(screen.getByLabelText(/Horas por mês/), '10')
    await user.click(screen.getByRole('switch', { name: /isento/i }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = vi.mocked(onSave).mock.calls[0]?.[1] as SupportPlanRequest
    expect(payload.slaIsento).toBe(true)
    expect(payload.slaPrimeiroAtendimentoMinutos).toBeNull()
  })
})

describe('SupportPlanFormModal — R-1: rename inseguro', () => {
  beforeEach(() => vi.clearAllMocks())

  it('avisa ao digitar novo nome em plano sem identificador e com clientes vinculados', async () => {
    const user = userEvent.setup()
    renderModal({ plan: plano })

    expect(screen.queryByText(/desvincularia todos eles/)).toBeNull()

    await user.clear(screen.getByLabelText(/Nome do plano/))
    await user.type(screen.getByLabelText(/Nome do plano/), 'Support Professional')

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('14 clientes vinculados')
    expect(aviso).toHaveTextContent('Preencha o identificador do HubSpot')
  })

  it('o aviso some quando o identificador do HubSpot é preenchido — companheira positiva', async () => {
    const user = userEvent.setup()
    renderModal({ plan: plano })

    await user.clear(screen.getByLabelText(/Nome do plano/))
    await user.type(screen.getByLabelText(/Nome do plano/), 'Support Professional')
    await screen.findByRole('alert')

    await user.type(screen.getByLabelText(/Identificador do HubSpot/), 'plano_pro')

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('NÃO bloqueia o envio — o backend é a fonte de verdade', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal({ plan: plano })

    await user.clear(screen.getByLabelText(/Nome do plano/))
    await user.type(screen.getByLabelText(/Nome do plano/), 'Support Professional')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
  })

  it('422 PLAN_RENAME_UNSAFE: modal CONTINUA aberto, erro inline no identificador', async () => {
    const user = userEvent.setup()
    const onSave = vi
      .fn()
      .mockRejectedValue(
        erroApi(422, 'PLAN_RENAME_UNSAFE', 'O plano tem 14 clientes vinculados por nome.'),
      )
    const onClose = vi.fn()
    renderModal({ plan: plano, onSave, onClose })

    await user.clear(screen.getByLabelText(/Nome do plano/))
    await user.type(screen.getByLabelText(/Nome do plano/), 'Support Professional')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    // A recusa mantém o formulário aberto: sem isso o usuário acharia que renomeou.
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Editar plano de suporte')).toBeInTheDocument()

    // ⚠️ Discriminador: NÃO basta procurar o texto "Preencha o identificador do HubSpot"
    // na tela — o aviso PREVENTIVO já contém essa frase, e a asserção passaria mesmo com o
    // tratamento do 422 removido (medido: a mutação `R1-SEM-CASE-RENAME` deixava este
    // teste verde). O que só existe quando o 422 é tratado é o erro **ligado ao campo**:
    // `setError('hubspotValor', …, { shouldFocus: true })` ⇒ `aria-invalid` + foco.
    const identificador = screen.getByLabelText(/Identificador do HubSpot/)
    await waitFor(() => expect(identificador).toHaveAttribute('aria-invalid', 'true'))
    expect(identificador).toHaveFocus()

    const mensagens = await screen.findAllByText(/Preencha o identificador do HubSpot/)
    expect(mensagens.length).toBeGreaterThan(0)
    // A mensagem do servidor é preservada — é ela que traz o número de clientes.
    expect(screen.getAllByText(/14 clientes vinculados por nome/).length).toBeGreaterThan(0)
  })

  it('422 PLAN_SLA_CONFLICT marca o CAMPO DA META, não o identificador', async () => {
    // Par do teste acima: prova que o campo de destino vem do código do erro, e não é um
    // valor fixo que acerta por sorte no caso do rename.
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(erroApi(422, 'PLAN_SLA_CONFLICT', 'Conflito.'))
    renderModal({ plan: { ...plano, hubspotValor: 'plano_pro' }, onSave })

    await user.type(screen.getByLabelText(/Meta de 1º atendimento/), '20')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const meta = screen.getByLabelText(/Meta de 1º atendimento/)
    await waitFor(() => expect(meta).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByLabelText(/Identificador do HubSpot/)).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('sucesso fecha o modal — o par que distingue "recusou" de "deu certo"', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal({ plan: plano, onClose })

    await user.clear(screen.getByLabelText(/Nome do plano/))
    await user.type(screen.getByLabelText(/Nome do plano/), 'Support Professional')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

describe('SupportPlanFormModal — calendário (BE-F2F3 ainda não existe)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('erro ao carregar calendários NÃO derruba o formulário; explica e mantém o padrão', () => {
    renderModal({ calendariosStatus: 'error', calendariosLista: [] })
    expect(screen.getByText(/Não foi possível carregar os calendários/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  })

  it('lista vazia tem texto PRÓPRIO — "não há" não é o mesmo que "não sei responder"', () => {
    renderModal({ calendariosStatus: 'ready', calendariosLista: [] })
    expect(screen.getByText(/Nenhum calendário cadastrado/)).toBeInTheDocument()
    expect(screen.queryByText(/Não foi possível carregar os calendários/)).toBeNull()
  })

  it('com calendários, seleciona e envia calendarioId como número', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal()

    await user.type(screen.getByLabelText(/Nome do plano/), 'Support 24x7')
    await user.type(screen.getByLabelText(/Horas por mês/), '10')

    await user.click(screen.getByRole('combobox', { name: /Calendário do plano/ }))
    await user.click(await screen.findByRole('option', { name: '24/7' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = vi.mocked(onSave).mock.calls[0]?.[1] as SupportPlanRequest
    expect(payload.calendarioId).toBe(2)
    expect(typeof payload.calendarioId).toBe('number')
  })
})

const lerCssDoDisco = (caminho: string): string =>
  readFileSync(resolve(process.cwd(), caminho), 'utf8')
const CASCATA_CSS = derivarCascataDeCssDoApp(lerCssDoDisco)
const TOKENS = lerTokensDeCor(CASCATA_CSS, lerCssDoDisco)
const TEMA = temaDaCascata(CASCATA_CSS, lerCssDoDisco, TOKENS)

/**
 * 124/FE-FIX2 · `D-3` — as duas dicas de campo deste formulário estavam em
 * `text-foreground/50` (3,04:1). A varredura abaixo é do DOM montado, e cobre também
 * qualquer texto novo que entre no modal depois.
 */
describe('SupportPlanFormModal — contraste AA (D-3)', () => {
  beforeEach(() => vi.clearAllMocks())

  function medirModal() {
    // `document.body`: o `Modal` compartilhado pode renderizar em portal, e varrer só o
    // `container` do render deixaria a árvore inteira de fora — varredura vazia passa em
    // qualquer asserção.
    return medirTextosDoDom(document.body, {
      tema: TEMA,
      fundoPadrao: TOKENS['--color-background'],
    })
  }

  it('nenhum texto do formulário fica abaixo de 4,5:1', () => {
    renderModal()

    const medidas = medirModal()
    expect(medidas.length).toBeGreaterThan(3)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('a dica do campo "Plano isento de SLA" está em /70, não em /50', () => {
    renderModal()

    const dica = screen.getByText(/ficam fora do indicador de 1º atendimento/)
    expect(dica.className).toContain('text-foreground/70')
    expect(dica.className).not.toContain('text-foreground/50')

    const medida = medirModal().find((m) => m.texto.startsWith('Os chamados deste plano'))
    expect(medida?.razao).toBeGreaterThanOrEqual(4.5)
  })
})
