import { Combobox } from '../../../components/ui/Combobox'
import { Input } from '../../../components/ui/Input'
import { MultiSelectCombobox } from '../../../components/ui/MultiSelectCombobox'
import { ClientCombobox } from '../../reports/shared/components/ClientCombobox'
import {
  ORIGENS_DO_CREDITO,
  rotuloDaOrigem,
  rotuloDoStatus,
  STATUS_DO_CREDITO,
} from '../types/hourCredit'
import type { HourCreditsFilters } from '../hooks/useHourCredits'

type CreditosFiltrosProps = {
  filters: HourCreditsFilters
  onChange: (parcial: Partial<HourCreditsFilters>) => void
}

/**
 * Filtros da tela de Créditos (132/F5).
 *
 * 🔴 As opções de **status** e **origem** são **derivadas** de `STATUS_DO_CREDITO` e
 * `ORIGENS_DO_CREDITO` — nunca redigitadas aqui. Duas listas do mesmo conjunto mantidas à
 * mão divergem; a única questão é quando (`rules/security.md` § "a enumeração que dá poder
 * a um invariante"). Valor fora do conjunto é `400 INVALID_STATUS`/`INVALID_ORIGEM` no
 * servidor, fail-closed (`analise-backend.md` §7.2).
 */
export function CreditosFiltros({ filters, onChange }: CreditosFiltrosProps) {
  const opcoesDeStatus = STATUS_DO_CREDITO.map((status) => ({
    value: status,
    label: rotuloDoStatus(status),
  }))

  const opcoesDeOrigem = ORIGENS_DO_CREDITO.map((origem) => ({
    value: origem,
    label: rotuloDaOrigem(origem),
  }))

  return (
    <div className="flex flex-wrap items-end gap-3">
      <ClientCombobox
        className="w-72"
        value={filters.clientId === null ? null : String(filters.clientId)}
        onChange={(clientId) => onChange({ clientId: clientId === null ? null : Number(clientId) })}
      />

      <div className="w-44">
        <Input
          id="filtro-competencia"
          label="Competência"
          type="month"
          value={filters.competencia ?? ''}
          onChange={(e) => onChange({ competencia: e.target.value || null })}
        />
      </div>

      <MultiSelectCombobox
        className="w-56"
        label="Status"
        summaryLabel="Status"
        value={filters.status}
        options={opcoesDeStatus}
        onChange={(status) => onChange({ status })}
      />

      <Combobox
        className="w-44"
        label="Origem"
        placeholder="Todas"
        value={filters.origem}
        options={opcoesDeOrigem}
        onChange={(origem) => onChange({ origem: origem === '' ? null : origem })}
      />

      <div className="w-64">
        <Input
          id="filtro-busca"
          label="Buscar"
          placeholder="Cliente, CNPJ ou chamado…"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>
    </div>
  )
}
