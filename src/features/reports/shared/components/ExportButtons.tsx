import { Button } from '../../../../components/ui/Button'

type ExportButtonsProps = {
  onExportCsv: () => void
  onExportXlsx: () => void
  onExportPdf?: () => void
  isExporting?: boolean
}

/**
 * Botões de export reutilizáveis.
 * onExportPdf é opcional — apenas U5 (Relatório do Cliente) usa PDF.
 */
export function ExportButtons({
  onExportCsv,
  onExportXlsx,
  onExportPdf,
  isExporting,
}: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        onClick={onExportCsv}
        isLoading={isExporting}
        disabled={isExporting}
      >
        Exportar CSV
      </Button>
      <Button
        variant="secondary"
        onClick={onExportXlsx}
        isLoading={isExporting}
        disabled={isExporting}
      >
        Exportar Excel
      </Button>
      {onExportPdf && (
        <Button
          variant="secondary"
          onClick={onExportPdf}
          isLoading={isExporting}
          disabled={isExporting}
        >
          Visualizar / Baixar PDF
        </Button>
      )}
    </div>
  )
}
