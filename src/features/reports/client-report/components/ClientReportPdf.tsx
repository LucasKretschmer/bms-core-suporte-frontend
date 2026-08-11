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
 *
 * A11Y (121/F-28 · D21): este é o ÚNICO modal do app com `<iframe>`, e por isso o único em
 * que o trap por tecla do `Modal` não fechava o ciclo — o `Tab` que sai do documento interno
 * do PDF alcançava a página atrás do overlay. Fechado aqui por uma **sentinela de foco**
 * depois do iframe (ver `handleSentinelaFocus`), sem tornar o resto do `body` inerte.
 *
 * A11Y (122/A-1): §5.3 são DUAS metades — "foco preso" (sentinela acima, dona deste arquivo
 * só por causa do iframe) e "devolve o foco ao gatilho" (ver `handleCloseModal`, dona de todo
 * consumidor do `Modal`). A segunda faltava aqui e o foco caía no `<body>`.
 *
 * ⚠️ LIMITE CONHECIDO, medido em Chrome real (122/A-3): com o foco DENTRO do visualizador de
 * PDF, o `Escape` NÃO fecha o modal — o `keydown` ocorre no documento do `<iframe>` e não
 * chega ao listener do `Modal`, que vive no documento de fora. É a mesma fronteira do F-28,
 * pela porta do `Escape`. Não é *keyboard trap* (WCAG 2.1.2): a saída por `Tab` existe (a
 * sentinela devolve o foco ao "Fechar modal", e daí o `Escape` funciona). Não é corrigível
 * daqui: ao contrário do `focus`, o evento de teclado não cruza a fronteira do documento, e o
 * documento interno é do visualizador do navegador — não é nosso para instrumentar.
 */

import { useRef, useState } from 'react'
import { Modal } from '../../../../components/ui/Modal'
import { focaveisDentro } from '../../../../components/ui/focusableElements'
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

/**
 * `id` do combobox "Baixar Relatório" — ele É o gatilho do modal, e é para ele que o
 * foco volta ao fechar (§5.3). Constante única de propósito: o mesmo valor alimenta a
 * prop `id` do `Combobox` e a busca em `handleCloseModal`, então os dois não podem
 * divergir em silêncio.
 */
const PDF_TYPE_COMBOBOX_ID = 'client-report-pdf-type'

export function ClientReportPdf({ report, filename, fetchAllItems }: ClientReportPdfProps) {
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'idle' })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { info: toastInfo, error: toastError } = useToast()
  const sentinelaRef = useRef<HTMLDivElement>(null)

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
    // DEVOLUÇÃO DE FOCO AO GATILHO (§5.3 · 122/A-1). É a OUTRA metade do requisito — a
    // prisão do foco é do `Modal`, a devolução é de quem abre (`Modal.tsx`, "O QUE ELE
    // NÃO FAZ"). Sem isto o `document.activeElement` vira o `<body>` e o usuário de
    // teclado recomeça do topo da página (medido em Chrome real pelo QA).
    // Mesmo mecanismo do irmão `BillingExceptionsCard.handleClose`:
    //   `setTimeout(0)` porque o `Modal` desmonta no MESMO commit — focar antes é no-op.
    // Por que por `id` e não por `ref`: o `Combobox` não é `forwardRef` e não expõe o
    // `<button>` do trigger; o `id` vem da constante única acima. `getElementById`
    // ainda garante que o alvo está no documento (equivalente ao `document.contains`
    // do outro irmão, `plan-consumption/index.tsx#handleCloseDrawer`).
    window.setTimeout(() => document.getElementById(PDF_TYPE_COMBOBOX_ID)?.focus(), 0)
  }

  /**
   * SENTINELA DE FOCO (121/F-28 · D21) — o único ponto do app em que o `Tab` escapava do
   * modal.
   *
   * Por que o trap do `Modal` não cobre isto: o PDF é um DOCUMENTO SEPARADO dentro do
   * `<iframe>`. Quando o foco está lá dentro, o `keydown` do `Tab` acontece no documento
   * interno e **nunca chega** ao listener do dialog — ao passar do último focável do
   * visualizador, o navegador entrega o foco ao próximo tabulável do documento de FORA, e
   * sem sentinela esse próximo está **atrás do overlay** (§5.3: "modal com foco preso" é
   * não negociável).
   *
   * A sentinela é esse "próximo": um alvo tabulável logo DEPOIS do iframe que não fica com
   * o foco — ela o devolve ao início do modal. É o único evento que o documento de fora
   * enxerga nessa transição, por isso o gancho é `focus` e não `keydown`.
   *
   * `aria-hidden="true"` é **carga estrutural, não enfeite**: é ele que tira a sentinela do
   * ciclo do trap (`focaveisDentro` exclui `[aria-hidden="true"]`). Sem ele a sentinela
   * viraria o ÚLTIMO focável do dialog e o `Shift+Tab` a partir do botão de fechar cairia
   * nela, que devolveria ao próprio botão de fechar — o `Shift+Tab` do primeiro deixaria de
   * alcançar o iframe. Travado pelo teste "Shift+Tab do botão de fechar vai ao IFRAME".
   * (Custo declarado: `aria-hidden` + `tabindex="0"` é o que o axe chama de
   * `aria-hidden-focus`; é o mesmo padrão de *focus guard* de bibliotecas de focus trap, e
   * o foco nunca REPOUSA aqui — ele é devolvido de forma síncrona no próprio evento.)
   *
   * ⛔ NÃO trocar por `inert`/`aria-hidden` no resto do `body`: deixaria inertes os portais
   * de `Toast` e `ConfirmDialog` (decisão DIF-06, opção (B) recusada).
   */
  function handleSentinelaFocus() {
    const dialog = sentinelaRef.current?.closest<HTMLElement>('[role="dialog"]')
    if (!dialog) return
    // Mesma definição de "focável" que o trap usa — sem seletor paralelo que diverge.
    // O `find` ignora a própria sentinela (defesa contra laço) caso ela um dia deixe de
    // ser excluída pelo `aria-hidden`.
    const destino =
      focaveisDentro(dialog).find((el) => el !== sentinelaRef.current) ?? dialog
    destino.focus()
  }

  const isLoading = pdfState.status === 'loading'

  return (
    <>
      {/* Combobox de tipo — dispara a geração/preview ao selecionar.
          Abre para BAIXO por padrão (sem `openUp`): o combobox fica no topo da
          área do relatório, então o dropdown para cima escondia a informação. */}
      <Combobox
        id={PDF_TYPE_COMBOBOX_ID}
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

            {/* Sentinela de foco — precisa vir IMEDIATAMENTE depois do iframe na ordem do
                documento: é essa posição que faz dela o próximo tabulável quando o foco sai
                do PDF. Ver `handleSentinelaFocus`. */}
            <div
              ref={sentinelaRef}
              data-focus-sentinel="pdf-preview"
              tabIndex={0}
              aria-hidden="true"
              onFocus={handleSentinelaFocus}
              className="sr-only"
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
