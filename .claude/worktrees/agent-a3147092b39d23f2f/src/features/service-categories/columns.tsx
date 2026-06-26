import type { ColumnDef } from '../../components/ui/DataTable/types'
import { Switch } from '../../components/ui/Switch'
import type { ServiceCategoryDto } from './types/serviceCategory'

type BuildColumnsArgs = {
  onToggle: (category: ServiceCategoryDto) => void
  onDelete: (category: ServiceCategoryDto) => void
  isToggling: boolean
  isDeleting: boolean
}

/**
 * Colunas da tabela de categorias.
 * Linha não clicável — ações (toggle/excluir) com stopPropagation por garantia.
 */
export function buildCategoryColumns({
  onToggle,
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
      width: '100px',
      accessor: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(row)
          }}
          disabled={isDeleting}
          aria-label={`Excluir categoria ${row.nome}`}
          className="text-error-fg text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded px-1 disabled:opacity-50"
        >
          excluir
        </button>
      ),
    },
  ]
}
