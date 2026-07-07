/**
 * Seleção de tipo + preview/download do PDF — U5 Relatório do Cliente (096).
 *
 * O antigo botão único "Visualizar / Baixar PDF" foi substituído por um combobox
 * de TIPO de relatório ("Detalhado" / "Consolidado"). Ao escolher um tipo, o PDF
 * daquele tipo é gerado a partir do conjunto COMPLETO de apontamentos (todas as
 * páginas — via `fetchAllItems`) e o preview abre num modal quase tela cheia
 * (92vw × 92vh, 4% de margem) com fundo borrado. O modal mantém o botão "Baixar PDF".
 *
 * ESCOPO: o combobox controla apenas o PDF/preview. A tabela on-screen permanece
 * Detalhada; CSV/Excel continuam inalterados (index.tsx).
 *
 * LAZY LOAD: @react-pdf/renderer é importado dinamicamente dentro de generateClientReportPdf.
 *
 * PRIVACIDADE: PDF usa o mesmo DTO da tela (ClientReportItemDto), sem categoria HubSpot.
 */

import { useState } from 'react'
import { Modal } from '../../../../components/ui/Modal'
import { Button } from '../../../../components/ui/Button'
import { Combobox } from '../../../../components/ui/Combobox'
import type { ClientReportDto, ClientReportItemDto } from '../../shared/types/reports'
import {
  generateClientReportPdf,
  downloadPdfBlob,
  type ClientReportPdfType,
} from '../../shared/utils/exportPdf'
import { useToast } from '../../../../components/ui/Toast'

type ClientReportPdfProps = {
  report: ClientReportDto
  /** Nome do arquivo para download (sem extensão) */
  filename: string
  /**
   * Busca TODOS os apontamentos (todas as páginas) para gerar o PDF completo —
   * nunca só a página visível. Provido pela página (reusa o fetchAll do export).
   */
  fetchAllItems: () => Promise<ClientReportItemDto[]>
}

type PdfState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; type: ClientReportPdfType; blob: Blob; previewUrl: string }
  | { status: 'error'; type: ClientReportPdfType; message: string }

/** Opções de tipo de relatório do combobox. */
const REPORT_TYPE_OPTIONS = [
  { value: 'detalhado', label: 'Detalhado' },
  { value: 'consolidado', label: 'Consolidado' },
]

export function ClientReportPdf({ report, filename, fetchAllItems }: ClientReportPdfProps) {
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'idle' })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { info: toastInfo, error: toastError } = useToast()

  async function generateAndOpen(type: ClientReportPdfType) {
    setPdfState({ status: 'loading' })
    try {
      toastInfo('Gerando PDF, aguarde…')
      const items = await fetchAllItems()
      const blob = await generateClientReportPdf({ report, items, type })
      const previewUrl = URL.createObjectURL(blob)
      setPdfState({ status: 'ready', type, blob, previewUrl })
      setIsModalOpen(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar o PDF.'
      setPdfState({ status: 'error', type, message })
      toastError(`Erro ao gerar PDF: ${message}`)
    }
  }

  function handleSelectType(value: string) {
    const type: ClientReportPdfType =
      value === 'consolidado' ? 'consolidado' : 'detalhado'
    void generateAndOpen(type)
  }

  function handleDownload() {
    if (pdfState.status !== 'ready') return
    downloadPdfBlob(pdfState.blob, `${filename}-${pdfState.type}`)
  }

  function handleCloseModal() {
    setIsModalOpen(false)
    // Revoga a URL ao fechar para liberar memória
    if (pdfState.status === 'ready') {
      URL.revokeObjectURL(pdfState.previewUrl)
    }
    setPdfState({ status: 'idle' })
  }

  const isLoading = pdfState.status === 'loading'

  return (
    <>
      {/* Combobox de tipo — dispara a geração/preview ao selecionar.
          Abre para BAIXO por padrão (sem `openUp`): o combobox fica no topo da
          área do relatório, então o dropdown para cima escondia a informação. */}
      <Combobox
        id="client-report-pdf-type"
        label="Baixar Relatório"
        value={null}
        options={REPORT_TYPE_OPTIONS}
        onChange={handleSelectType}
        placeholder={isLoading ? 'Gerando…' : 'Baixar Relatório'}
        disabled={isLoading}
        alignRight
        className="min-w-[180px] [&>label]:sr-only"
      />

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={
          pdfState.status === 'ready'
            ? `Relatório do Cliente — PDF (${pdfState.type === 'consolidado' ? 'Consolidado' : 'Detalhado'})`
            : 'Relatório do Cliente — PDF'
        }
        size="fullscreen"
        backdropBlur="lg"
      >
        {pdfState.status === 'ready' && (
          <div className="flex flex-col gap-4 h-full min-h-0">
            {/* Ação de download dentro do modal */}
            <div className="flex justify-end shrink-0">
              <Button
                variant="primary"
                onClick={handleDownload}
                aria-label="Baixar PDF do relatório"
              >
                Baixar PDF
              </Button>
            </div>

            {/* Preview do PDF via iframe — preenche a área interna do modal grande. */}
            <iframe
              src={pdfState.previewUrl}
              title="Preview do relatório em PDF"
              className="w-full flex-1 min-h-0 border border-border rounded-control"
              aria-label="Preview do PDF do relatório do cliente"
            />
          </div>
        )}

        {pdfState.status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-foreground/70">
              Não foi possível gerar o PDF. Tente novamente.
            </p>
            <Button
              variant="primary"
              onClick={() => generateAndOpen(pdfState.type)}
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
