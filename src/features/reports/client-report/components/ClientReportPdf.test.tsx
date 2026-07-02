/**
 * Testes do componente ClientReportPdf (096).
 * Cobre o comportamento do combobox de tipo (alterna Detalhado/Consolidado, dispara
 * geração e abre o preview) e a integração com o Modal fullscreen.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
