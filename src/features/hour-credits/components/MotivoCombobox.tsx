import { Combobox } from '../../../components/ui/Combobox'
import { useHourCreditReasons } from '../../hour-credit-reasons/hooks/useHourCreditReasons'

type MotivoComboboxProps = {
  id?: string
  /** `null` = nada selecionado. */
  value: number | null
  onChange: (motivoId: number | null) => void
  error?: string
  required?: boolean
  className?: string
}

/**
 * Seleção do motivo do crédito (132/F5).
 *
 * Consome o MESMO hook da tela de Motivos (`useHourCreditReasons`), com
 * `includeInactive=false`: crédito novo com motivo desativado é `404` no servidor
 * (`analise-backend.md` §7.2) — oferecer a opção seria oferecer um erro.
 *
 * Reaproveita o hook em vez de duplicar a query: chave e `queryFn` iguais significam
 * **uma** entrada de cache e uma fonte só (é o defeito que `queryKeyRegistry.test.ts`
 * existe para pegar quando duas telas divergem).
 *
 * D15: o rótulo exibido é o nome **completo** do motivo — tela `GerentePlus`.
 */
export function MotivoCombobox({
  id,
  value,
  onChange,
  error,
  required,
  className,
}: MotivoComboboxProps) {
  const { data, isLoading, isError } = useHourCreditReasons(false)

  const options = (data ?? []).map((motivo) => ({
    value: String(motivo.id),
    label: motivo.nome,
  }))

  return (
    <Combobox
      id={id}
      label="Motivo"
      required={required}
      className={className}
      value={value === null ? null : String(value)}
      options={options}
      isLoading={isLoading}
      placeholder={isLoading ? 'Carregando motivos…' : 'Selecione o motivo…'}
      // O erro de carga não some em silêncio: sem motivo não há crédito, e um combo vazio
      // sem explicação parece "não há motivos cadastrados" — que é outra afirmação.
      error={error ?? (isError ? 'Não foi possível carregar os motivos.' : undefined)}
      onChange={(bruto) => onChange(bruto === '' ? null : Number(bruto))}
    />
  )
}
