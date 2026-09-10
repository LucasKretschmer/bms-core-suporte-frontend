import { useMemo } from 'react'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listPlanConsumption } from '../../shared/services/reportsService'
import { defaultCurrentMonthPeriod } from '../../shared/utils/defaultPeriod'
import type {
  PlanConsumptionItemDto,
  PlanConsumptionResponseDto,
} from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'
import type { FaixaUsoDoPlano } from '../usoDoPlanoTextos'

type PlanConsumptionFilters = {
  search: string
  planId: string | null
  from: string | null
  to: string | null
  /**
   * 135/G5 — o filtro "Uso do plano". Guarda **só faixas** (`dentro`/`risco`/`fora`) e
   * **nunca** o sentinela `todos`: `[]` já significa "todos", e é isso que torna
   * *"Todos + só Em Risco"* **inexpressável** em vez de um estado válido que um handler
   * recusa (135/G2). A tradução `[] → ['todos']` acontece só na apresentação
   * (`valorExibidoUsoDoPlano`), e a volta em `normalizarSelecaoUsoDoPlano`.
   *
   * 🔴 **Nunca `undefined`.** O estado inicial é `[]` (array vazio) porque
   * `valorExibidoUsoDoPlano` não tolera `undefined` de propósito — um fixture que mande
   * `undefined` **deve** estourar em vez de renderizar um filtro sem valor.
   */
  usoPlano: FaixaUsoDoPlano[]
}

/**
 * Filtros iniciais — período default = mês corrente (clearable), via helper compartilhado (053).
 * O backend já assume o mês corrente quando from/to vêm nulos; preencher no front
 * deixa o período visível ao usuário sem torná-lo obrigatório.
 */
function buildInitialFilters(): PlanConsumptionFilters {
  const period = defaultCurrentMonthPeriod()
  return {
    search: '',
    planId: null,
    from: period.from,
    to: period.to,
    // `[]` = "todos" (135/G2). Array vazio, NUNCA `undefined` — ver o tipo acima.
    usoPlano: [],
  }
}

/**
 * Hook de tabela server-side para U3 — Consumo de Planos.
 * Usa useServerTable com queryKey 'plan-consumption'.
 * enabled=true sempre (não requer filtros obrigatórios).
 *
 * 🔴 **132/F4d — o TERCEIRO genérico não é decoração.** Sem
 * `PlanConsumptionResponseDto`, `useServerTable` estreita `data` para
 * `PaginatedResponse<PlanConsumptionItemDto>` e os campos do envelope de D12
 * (`fonte`, `competencia`, `competenciaFechadaEm`, `competenciaVersao`, `aviso*`)
 * **existem em runtime e desaparecem do tipo**. O selo de mês fechado nunca apareceria, sem
 * erro nenhum — e a única saída seria um `as`, que é proibido. O compilador reprovou
 * exatamente aqui quando o aviso foi ligado à tela, que é o comportamento desejado.
 */
export function usePlanConsumption() {
  // useServerTable só usa initialFilters na 1ª render — memoizar mantém referência estável.
  const initialFilters = useMemo(buildInitialFilters, [])

  return useServerTable<
    PlanConsumptionFilters,
    PlanConsumptionItemDto,
    PlanConsumptionResponseDto
  >({
    queryKey: 'plan-consumption',
    queryFn: (params: TableParams<PlanConsumptionFilters>) =>
      listPlanConsumption({
        search: params.filters.search || undefined,
        planId: params.filters.planId,
        from: params.filters.from,
        to: params.filters.to,
        // 🔴 135/§3.5.1 — nada selecionado ⇒ o parâmetro NÃO SAI. `cleanParams` do service
        // descarta `null`/`undefined`/`''`, mas **não** array vazio (medido e travado em
        // `reportsService.test.ts`), então `usoPlano: []` viajaria como `?usoPlano=`. O
        // servidor tolera isso como ausência, mas depender da tolerância de terceiro é
        // construir sobre ela. A conversão é do call site — e este é UM dos dois: o outro é
        // `fetchAllForExport`, em `index.tsx`.
        usoPlano: params.filters.usoPlano.length > 0 ? params.filters.usoPlano : undefined,
        sortBy: params.sortBy,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    initialFilters,
    initialPageSize: 25,
    enabled: true,
  })
}
