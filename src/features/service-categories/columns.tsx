import type { ColumnDef } from '../../components/ui/DataTable/types'
import { Switch } from '../../components/ui/Switch'
import type { ServiceCategoryDto } from './types/serviceCategory'

type BuildColumnsArgs = {
  onToggle: (category: ServiceCategoryDto) => void
  /** Abre o modal de renomear (123/FE-2 · D6/A6). */
  onEdit: (category: ServiceCategoryDto) => void
  onDelete: (category: ServiceCategoryDto) => void
  isToggling: boolean
  isDeleting: boolean
}

const acaoClassName =
  'text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded px-1 disabled:opacity-50'

/**
 * Colunas da tabela de categorias.
 * Linha não clicável — ações (toggle/editar/excluir) com stopPropagation por garantia.
 *
 * "editar" aparece também em linha **inativa**: o `UpdateAsync` do backend não filtra por
 * `DesativadoEm` (`ServiceCategoryService.cs:66-91`), então renomear categoria desativada
 * é suportado e a UI não deve esconder a ação.
 */
export function buildCategoryColumns({
  onToggle,
  onEdit,
  onDelete,
  isToggling,
  isDeleting,
}: BuildColumnsArgs): ColumnDef<ServiceCategoryDto>[] {
  return [
    {
      key: 'nome',
      header: 'Categoria',
      align: 'left',
      accessor: (row) => (
        <span className={row.isActive ? 'text-foreground' : 'text-foreground/50'}>{row.nome}</span>
      ),
    },
    {
      key: 'ativa',
      header: 'Ativa',
      align: 'center',
      width: '120px',
      accessor: (row) => (
        <span
          className="inline-flex justify-center"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Switch
            checked={row.isActive}
            disabled={isToggling}
            onChange={() => onToggle(row)}
            label={`${row.isActive ? 'Desativar' : 'Ativar'} categoria ${row.nome}`}
          />
        </span>
      ),
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'center',
      width: '160px',
      accessor: (row) => (
        <span className="inline-flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(row)
            }}
            aria-label={`Editar categoria ${row.nome}`}
            className={`text-primary ${acaoClassName}`}
          >
            editar
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(row)
            }}
            disabled={isDeleting}
            aria-label={`Excluir categoria ${row.nome}`}
            className={`text-error-fg ${acaoClassName}`}
          >
            excluir
          </button>
        </span>
      ),
    },
  ]
}
