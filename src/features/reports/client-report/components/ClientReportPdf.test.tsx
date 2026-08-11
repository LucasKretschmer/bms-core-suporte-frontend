/**
 * Testes do componente ClientReportPdf (096).
 * Cobre o comportamento do combobox de tipo (alterna Detalhado/Consolidado, dispara
 * geração e abre o preview) e a integração com o Modal fullscreen.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ClientReportPdf } from './ClientReportPdf'
import { ToastProvider } from '../../../../components/ui/Toast'
import type { ClientReportDto, ClientReportItemDto } from '../../shared/types/reports'

// Mocka a geração de PDF (lazy @react-pdf/renderer) e o download — testamos o
// comportamento do componente, não a lib de PDF.
const generateMock = vi.fn<
  (args: { type: string }) => Promise<Blob>
>()
const downloadMock = vi.fn()

vi.mock('../../shared/utils/exportPdf', () => ({
  generateClientReportPdf: (args: { type: string }) => generateMock(args),
  downloadPdfBlob: (...args: unknown[]) => downloadMock(...args),
}))

const REPORT: ClientReportDto = {
  client: {
    id: 1,
    hubspotCompanyId: 10,
    cnpj: null,
    razaoSocial: 'ACME',
    nomeFantasia: 'ACME',
    supportPlan: null,
    horasOverride: null,
    horasEfetivas: null,
  },
  plano: null,
  competencia: '2024-03',
  totalApontamentos: 1,
  totalSegundos: 600,
  horasPlanoSegundos: 0,
  horasFaturadoSegundos: 0,
  horasNaoFaturadoSegundos: 0,
  items: null,
}

const ITEMS: ClientReportItemDto[] = [
  {
    timeEntryId: 1,
    origem: 'ticket',
    ticketId: 100,
    hubspotTicketId: '100',
    projetoId: null,
    projetoNome: null,
    stage: null,
    assunto: 'A',
    equipeAtribuida: 'Suporte',
    solicitante: null,
    atendente: 'Ana',
    donoChamado: 'Dono',
    categorizacaoAtendimento: 'Consultoria',
    servico: 'Suporte Técnico',
    servicoSecundario: 'Configuração',
    faturamento: 'Faturado',
    aberturaDosChamado: null,
    dataApontamento: '2024-03-10T09:00:00Z',
    totalSegundos: 600,
  },
]

function renderComponent(fetchAllItems = vi.fn().mockResolvedValue(ITEMS)) {
  return {
    fetchAllItems,
    ...render(
      <ToastProvider>
        <ClientReportPdf
          report={REPORT}
          filename="relatorio-cliente-acme"
          fetchAllItems={fetchAllItems}
        />
      </ToastProvider>,
    ),
  }
}

beforeEach(() => {
  generateMock.mockReset().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
  downloadMock.mockReset()
  // jsdom não implementa URL.createObjectURL/revokeObjectURL
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('ClientReportPdf', () => {
  it('renderiza o combobox de tipo com as opções Detalhado e Consolidado', () => {
    renderComponent()
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    expect(screen.getByText('Detalhado')).toBeInTheDocument()
    expect(screen.getByText('Consolidado')).toBeInTheDocument()
  })

  it('exibe o rótulo "Baixar Relatório" no trigger (placeholder e aria-label)', () => {
    renderComponent()
    const trigger = screen.getByRole('combobox')
    // Placeholder visível no trigger enquanto nada está selecionado.
    expect(trigger).toHaveTextContent('Baixar Relatório')
    // aria-label acessível herdado do label (sr-only) do Combobox.
    expect(screen.getByRole('combobox', { name: /baixar relatório/i })).toBe(trigger)
  })

  it('abre o dropdown para baixo (sem openUp: usa top-full, não bottom-full)', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('combobox'))
    // O painel do dropdown é o container que envolve o listbox.
    const listbox = screen.getByRole('listbox')
    const panel = listbox.closest('div.absolute')
    expect(panel).not.toBeNull()
    expect(panel).toHaveClass('top-full')
    expect(panel).not.toHaveClass('bottom-full')
  })

  it('ao escolher Consolidado, busca itens, gera o PDF consolidado e abre o preview', async () => {
    const { fetchAllItems } = renderComponent()
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Consolidado'))

    await waitFor(() => {
      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'consolidado' }),
      )
    })
    expect(fetchAllItems).toHaveBeenCalledTimes(1)

    // Preview aberto: iframe + botão de download
    await waitFor(() => {
      expect(screen.getByTitle('Preview do relatório em PDF')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Baixar PDF do relatório')).toBeInTheDocument()
    expect(screen.getByText(/Consolidado/i)).toBeInTheDocument()
  })

  it('ao escolher Detalhado, gera o PDF detalhado', async () => {
    renderComponent()
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Detalhado'))

    await waitFor(() => {
      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'detalhado' }),
      )
    })
  })

  it('baixa o PDF com o sufixo do tipo ao clicar em Baixar PDF', async () => {
    renderComponent()
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Consolidado'))

    await waitFor(() => screen.getByLabelText('Baixar PDF do relatório'))
    fireEvent.click(screen.getByLabelText('Baixar PDF do relatório'))

    expect(downloadMock).toHaveBeenCalledWith(
      expect.any(Blob),
      'relatorio-cliente-acme-consolidado',
    )
  })
})

/**
 * SENTINELA DE FOCO do preview de PDF (121/F-28 · decisão D21).
 *
 * ⚠️ O QUE O JSDOM NÃO CONSEGUE FAZER — e por isso não é simulado aqui:
 * o jsdom **não carrega** o documento dentro do `<iframe>` (o `src` é um `blob:` mockado)
 * e **não implementa navegação sequencial de foco entre documentos**. Logo, o passo real
 * "o usuário aperta `Tab` no último focável do visualizador de PDF" é **irreproduzível**
 * neste ambiente — nem com `userEvent.tab()`, que sequer inclui `iframe` no seletor de
 * focáveis dele.
 *
 * O QUE ESTES TESTES PROVAM, então: o navegador, nessa transição, faz exatamente UMA coisa
 * observável no documento de fora — **entrega o foco ao próximo tabulável depois do
 * iframe**. Os testes (1) travam que esse próximo é a sentinela (posição no DOM +
 * `tabindex`), e (2) exercitam a entrega de foco chamando `.focus()` nela, asseverando
 * **para onde** o foco foi (identidade do elemento), nunca "não saiu".
 *
 * O passo entre documentos continua exigindo o roteiro manual em browser real
 * (`pdf-1-report.md`).
 */
describe('ClientReportPdf — sentinela de foco do preview (F-28/D21)', () => {
  async function abrirPreview() {
    renderComponent()
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Consolidado'))
    const iframe = await screen.findByTitle('Preview do relatório em PDF')
    const sentinela = document.querySelector<HTMLElement>('[data-focus-sentinel]')
    return { iframe, sentinela }
  }

  it('a sentinela existe IMEDIATAMENTE depois do iframe e é tabulável', async () => {
    const { iframe, sentinela } = await abrirPreview()

    expect(sentinela).not.toBeNull()
    // Posição é o mecanismo: só sendo o vizinho seguinte ela recebe o foco que sai do PDF.
    expect(iframe.nextElementSibling).toBe(sentinela)
    expect(sentinela).toHaveAttribute('tabindex', '0')
    // `aria-hidden` é carga estrutural: é o que a mantém FORA do ciclo do trap do Modal
    // (`focaveisDentro` exclui `[aria-hidden="true"]`) — ver o teste do Shift+Tab abaixo.
    expect(sentinela).toHaveAttribute('aria-hidden', 'true')
  })

  it('foco entregue à sentinela (saída do PDF) volta ao PRIMEIRO focável do modal', async () => {
    const { sentinela } = await abrirPreview()

    // Ancora fora da sentinela para que o `.focus()` seja uma transição de verdade.
    const baixar = screen.getByLabelText('Baixar PDF do relatório')
    baixar.focus()
    expect(baixar).toHaveFocus()

    // É isto que o navegador faz quando o `Tab` passa do fim do documento interno do PDF.
    sentinela!.focus()

    // Identidade do destino, não "não é o body": o botão de fechar é o primeiro focável do
    // dialog. Sem o handler, o foco PARARIA na própria sentinela (prova de detecção no
    // relatório: removê-la deixa este teste vermelho).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Fechar modal' })).toHaveFocus()
    })
    expect(sentinela).not.toHaveFocus()
  })

  it('Shift+Tab do botão de fechar vai ao IFRAME — a sentinela não vira parada do ciclo', async () => {
    const { iframe } = await abrirPreview()

    // O Modal põe o foco no botão de fechar ao abrir.
    const fechar = screen.getByRole('button', { name: 'Fechar modal' })
    await waitFor(() => expect(fechar).toHaveFocus())

    await userEvent.tab({ shift: true })

    // Se a sentinela entrasse no ciclo (ex.: alguém remover o `aria-hidden`), ela seria o
    // ÚLTIMO focável do dialog: o trap mandaria o foco para ela e o handler o devolveria ao
    // botão de fechar — o iframe deixaria de ser alcançável por Shift+Tab, e este assert
    // ficaria vermelho.
    expect(iframe).toHaveFocus()
  })

  it('Tab a partir do iframe circula para o botão de fechar (ciclo fechado no documento de fora)', async () => {
    const { iframe } = await abrirPreview()

    iframe.focus()
    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'Fechar modal' })).toHaveFocus()
  })
})

/**
 * DEVOLUÇÃO DE FOCO AO GATILHO — a OUTRA metade de §5.3 (122/A-1).
 *
 * O requisito é *"modal com foco preso **E** devolve o foco ao gatilho"*: dois mecanismos com
 * donos diferentes (o trap é do `Modal`; a devolução é de quem abre — ver `Modal.tsx`, seção
 * "O QUE ELE NÃO FAZ"). O bloco acima cobre a prisão; este cobre a devolução, que faltava
 * inteira. Medição do QA em Chrome real, ANTES da correção: `document.activeElement === BODY`.
 *
 * Cada caso assevera a **identidade** do elemento que ficou com o foco (o combobox "Baixar
 * Relatório"), nunca "não é o body" — e nunca a ausência de foco em algum outro lugar.
 *
 * Cada caso carrega um **discriminador na mesma execução**: antes de fechar, o foco está
 * comprovadamente DENTRO do modal (no "Fechar modal"). Sem ele, um teste que só olha o fim
 * passaria também num mundo em que o foco nunca tivesse saído do gatilho — o assert ficaria
 * verde sem que a devolução existisse.
 */
describe('ClientReportPdf — devolução do foco ao gatilho ao fechar (§5.3 · 122/A-1)', () => {
  async function abrirPreviewPeloGatilho() {
    renderComponent()
    const gatilho = screen.getByRole('combobox', { name: /baixar relatório/i })
    fireEvent.click(gatilho)
    fireEvent.click(screen.getByText('Consolidado'))

    const fechar = await screen.findByRole('button', { name: 'Fechar modal' })
    // Discriminador: o foco saiu do gatilho e está dentro do dialog.
    await waitFor(() => expect(fechar).toHaveFocus())
    expect(gatilho).not.toHaveFocus()

    return { gatilho, fechar }
  }

  it('fechar pelo "X" devolve o foco ao combobox "Baixar Relatório"', async () => {
    const { gatilho, fechar } = await abrirPreviewPeloGatilho()

    await userEvent.click(fechar)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Identidade do destino: é o MESMO nó que abriu o modal…
    await waitFor(() => expect(gatilho).toHaveFocus())
    // …e ele continua sendo o combobox da tela (guarda contra o nó ter sido recriado e o
    // assert acima passar a medir um elemento fora do documento).
    expect(gatilho).toBe(screen.getByRole('combobox', { name: /baixar relatório/i }))
    expect(document.body).not.toHaveFocus()
  })

  it('fechar pelo Escape (roteiro manual, passo 6) devolve o foco ao mesmo gatilho', async () => {
    const { gatilho } = await abrirPreviewPeloGatilho()

    // Com o foco no "Fechar modal" — dentro do documento de fora — o Escape fecha.
    // (Com o foco DENTRO do visualizador de PDF ele NÃO fecha: o `keydown` não cruza a
    // fronteira do `<iframe>`. Isso é irreproduzível em jsdom e vive no roteiro manual.)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await waitFor(() => expect(gatilho).toHaveFocus())
    expect(gatilho).toBe(screen.getByRole('combobox', { name: /baixar relatório/i }))
  })
})
