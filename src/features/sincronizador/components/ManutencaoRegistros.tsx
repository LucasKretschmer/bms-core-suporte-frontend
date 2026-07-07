import { zodResolver } from '@hookform/resolvers/zod'
import { clsx } from 'clsx'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useToast } from '../../../components/ui/Toast'
import { ExportButtons } from '../../reports/shared/components/ExportButtons'
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../../reports/shared/utils/exportTable'
import { useDeleteRegistro } from '../hooks/useDeleteRegistro'
import { useRegistrosBusca } from '../hooks/useRegistrosBusca'
import type { BuscaRegistroFormData, RegistroDto, RegistroTipo } from '../types/sincronizador'
import { buscaRegistroSchema } from '../types/sincronizador'

/** Colunas de export — espelham a tabela visível (sem a coluna de ação). */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Tipo', key: 'tipo' },
  { header: 'ID HubSpot', key: 'hubspotId' },
  { header: 'Assunto', key: 'assunto' },
  { header: 'Pipeline', key: 'pipeline' },
  { header: 'Criado em', key: 'criadoEm' },
]

function mapRegistroToExportRow(registro: RegistroDto): ExportRow {
  return {
    tipo: registro.tipo === 'ticket' ? 'Ticket' : 'Projeto',
    hubspotId: registro.hubspotId,
    assunto: registro.assunto,
    pipeline: registro.pipeline ?? '—',
    criadoEm: formatDate(registro.criadoEm),
  }
}

type ManutencaoRegistrosProps = {
  className?: string
}

type RegistroSelecionado = {
  hubspotId: string
  tipo: RegistroTipo
  assunto: string
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return iso
  }
}

/** Badge de tipo ticket/projeto */
function TipoBadge({ tipo }: { tipo: RegistroTipo }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-medium',
        tipo === 'ticket'
          ? 'bg-info-bg text-info-fg'
          : 'bg-badge-plano-bg text-badge-plano-fg',
      )}
    >
      {tipo === 'ticket' ? 'Ticket' : 'Projeto'}
    </span>
  )
}

/** Linha da tabela de resultados */
function RegistroRow({
  registro,
  onDesativar,
}: {
  registro: RegistroDto
  onDesativar: (r: RegistroSelecionado) => void
}) {
  return (
    <tr className="border-[0.7px] border-border border-t-0 h-[38px]">
      <td className="px-5 py-[9px] text-[12px]">
        <TipoBadge tipo={registro.tipo} />
      </td>
      <td className="px-5 py-[9px] text-[12px] font-mono text-foreground/80">
        {registro.hubspotId}
      </td>
      <td className="px-5 py-[9px] text-[12px]">
        <span title={registro.assunto} className="block truncate max-w-[300px]">
          {registro.assunto}
        </span>
      </td>
      <td className="px-5 py-[9px] text-[12px] text-foreground/70">
        {registro.pipeline ?? '—'}
      </td>
      <td className="px-5 py-[9px] text-[12px] text-center text-foreground/70">
        {formatDate(registro.criadoEm)}
      </td>
      <td className="px-5 py-[9px] text-[12px] text-center">
        <button
          type="button"
          onClick={() =>
            onDesativar({
              hubspotId: registro.hubspotId,
              tipo: registro.tipo,
              assunto: registro.assunto,
            })
          }
          aria-label={`Desativar ${registro.tipo} #${registro.hubspotId} — ${registro.assunto}`}
          className={clsx(
            'inline-flex items-center justify-center gap-1.5 h-7 px-2',
            'rounded-control text-[12px] font-semibold text-error-fg',
            'border border-transparent bg-transparent',
            'transition-shadow duration-150 cursor-pointer',
            'hover:shadow-hover',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
          )}
        >
          Desativar
        </button>
      </td>
    </tr>
  )
}

/**
 * Seção de manutenção de registros (tickets e projetos HubSpot).
 * Busca manual via RHF + Zod. Soft-delete com ConfirmDialog.
 * Backend retorna apenas registros ativos — após o delete (204) a query é
 * invalidada e a linha some da lista (o toast confirma a ação).
 */
export function ManutencaoRegistros({ className }: ManutencaoRegistrosProps) {
  const { query, handleBusca } = useRegistrosBusca()
  const deleteMutation = useDeleteRegistro()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [registroSelecionado, setRegistroSelecionado] = useState<RegistroSelecionado | null>(null)
  const desativarButtonRef = useRef<HTMLButtonElement | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BuscaRegistroFormData>({
    resolver: zodResolver(buscaRegistroSchema),
  })

  function onSubmit(values: BuscaRegistroFormData) {
    handleBusca(values.busca)
  }

  function handleDesativar(r: RegistroSelecionado) {
    setRegistroSelecionado(r)
  }

  function handleConfirmDelete() {
    if (!registroSelecionado) return
    deleteMutation.mutate(
      { tipo: registroSelecionado.tipo, hubspotId: registroSelecionado.hubspotId },
      {
        onSettled: () => {
          setRegistroSelecionado(null)
          // Devolver foco ao botão que abriu o dialog
          desativarButtonRef.current?.focus()
        },
      },
    )
  }

  const registros: RegistroDto[] = query.data ?? []

  function handleExportCsv() {
    if (isExporting || registros.length === 0) return
    setIsExporting(true)
    try {
      exportToCsv('sincronizador-registros', EXPORT_COLUMNS, registros.map(mapRegistroToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    if (isExporting || registros.length === 0) return
    setIsExporting(true)
    try {
      await exportToXlsx('sincronizador-registros', EXPORT_COLUMNS, registros.map(mapRegistroToExportRow))
      toast.success('Exportação Excel concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className={className}>
      {/* Formulário de busca */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            label="Buscar registros"
            placeholder="ID HubSpot ou trecho do assunto"
            error={errors.busca?.message}
            {...register('busca')}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          isLoading={query.isFetching && !query.data}
        >
          Buscar
        </Button>
      </form>

      {/* Resultados */}
      <div className="mt-4">
        {query.isFetching && !query.data && <Skeleton lines={4} />}
        {query.isError && !query.isFetching && (
          <ErrorState
            message="Não foi possível carregar os registros."
            onRetry={() => query.refetch()}
          />
        )}
        {!query.isFetching && !query.isError && query.data !== undefined && registros.length === 0 && (
          <EmptyState message="Nenhum registro encontrado para esta busca." />
        )}

        {registros.length > 0 && (
          <div className="mb-3 flex justify-end">
            <ExportButtons
              onExportCsv={handleExportCsv}
              onExportXlsx={() => void handleExportXlsx()}
              isExporting={isExporting}
            />
          </div>
        )}

        {registros.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['Tipo', 'ID HubSpot', 'Assunto', 'Pipeline', 'Criado em', 'Ação'].map((col) => (
                    <th
                      key={col}
                      className={clsx(
                        'h-9 px-5 font-medium text-foreground/80 bg-background text-center',
                        'border-[0.7px] border-border',
                        'first:rounded-tl-input last:rounded-tr-input',
                        'border-b border-border',
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <RegistroRow
                    key={`${r.tipo}-${r.hubspotId}`}
                    registro={r}
                    onDesativar={(sel) => {
                      // Guardar ref do botão ativo para devolver o foco
                      desativarButtonRef.current = document.activeElement as HTMLButtonElement
                      handleDesativar(sel)
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog de confirmação */}
      <ConfirmDialog
        isOpen={registroSelecionado !== null}
        onClose={() => {
          setRegistroSelecionado(null)
          desativarButtonRef.current?.focus()
        }}
        onConfirm={handleConfirmDelete}
        title="Desativar registro"
        description={
          registroSelecionado
            ? `Deseja desativar o ${registroSelecionado.tipo} #${registroSelecionado.hubspotId} — ${registroSelecionado.assunto}? Esta ação pode ser revertida pelo suporte técnico.`
            : ''
        }
        confirmLabel="Desativar"
        cancelLabel="Cancelar"
        isLoading={deleteMutation.isPending}
        variant="danger"
      />
    </div>
  )
}
