/**
 * Componente de preview + download do PDF — U5 Relatório do Cliente.
 *
 * LAZY LOAD: @react-pdf/renderer é importado dinamicamente apenas ao clicar no botão.
 * Isso garante que o bundle inicial das outras telas não seja afetado.
 *
 * PRIVACIDADE: O PDF usa exatamente o mesmo DTO que a tela (ClientReportItemDto).
 * Esse DTO não contém o campo de categoria do HubSpot — garantia em tempo de tipo.
 * A categoria interna ("categorização do atendimento") é exibida normalmente.
 * A coluna "Faturamento" usa apenas os 3 status seguros (Plano de Suporte / Faturado / Não faturado).
 */

import { useState } from 'react'
import { Modal } from '../../../../components/ui/Modal'
import { Button } from '../../../../components/ui/Button'
import type { ClientReportDto } from '../../shared/types/reports'
import {
  generateClientReportPdf,
  downloadPdfBlob,
} from '../../shared/utils/exportPdf'
import { useToast } from '../../../../components/ui/Toast'

type ClientReportPdfProps = {
  report: ClientReportDto
  /** Nome do arquivo para download (sem extensão) */
  filename: string
}

type PdfState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; blob: Blob; previewUrl: string }
  | { status: 'error'; message: string }

export function ClientReportPdf({ report, filename }: ClientReportPdfProps) {
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'idle' })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { info: toastInfo, error: toastError } = useToast()

  async function handleOpenPdf() {
    // Se já foi gerado, apenas abre o modal
    if (pdfState.status === 'ready') {
      setIsModalOpen(true)
      return
    }

    setPdfState({ status: 'loading' })

    try {
      toastInfo('Gerando PDF, aguarde…')
      const blob = await generateClientReportPdf(report)
      const previewUrl = URL.createObjectURL(blob)
      setPdfState({ status: 'ready', blob, previewUrl })
      setIsModalOpen(true)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao gerar o PDF.'
      setPdfState({ status: 'error', message })
      toastError(`Erro ao gerar PDF: ${message}`)
    }
  }

  function handleDownload() {
    if (pdfState.status !== 'ready') return
    downloadPdfBlob(pdfState.blob, filename)
  }

  function handleCloseModal() {
    setIsModalOpen(false)
    // Revoga a URL ao fechar para liberar memória
    if (pdfState.status === 'ready') {
      URL.revokeObjectURL(pdfState.previewUrl)
      setPdfState({ status: 'idle' })
    }
  }

  const isLoading = pdfState.status === 'loading'

  return (
    <>
      <Button
        variant="secondary"
        onClick={handleOpenPdf}
        isLoading={isLoading}
        disabled={isLoading}
        aria-label="Visualizar ou baixar relatório em PDF"
      >
        Visualizar / Baixar PDF
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Relatório do Cliente — PDF"
        size="xl"
      >
        {pdfState.status === 'ready' && (
          <div className="flex flex-col gap-4">
            {/* Ação de download dentro do modal */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleDownload}
                aria-label="Baixar PDF do relatório"
              >
                Baixar PDF
              </Button>
            </div>

            {/* Preview do PDF via iframe (alternativa ao PDFViewer do renderer
                que pode ter problemas de SSR/bundle em alguns ambientes) */}
            <iframe
              src={pdfState.previewUrl}
              title="Preview do relatório em PDF"
              className="w-full border border-border rounded-[5px]"
              style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
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
              onClick={() => {
                setPdfState({ status: 'idle' })
                handleOpenPdf()
              }}
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
