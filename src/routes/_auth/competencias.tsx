import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
  useSearch,
} from '@tanstack/react-router'
import { z } from 'zod'
import { tokenStore } from '../../utils/tokenStore'

/**
 * Rota: /competencias — Competências de faturamento (132/F7).
 *
 * Auth: token válido (a guarda de role `GerentePlus` fica na página, como no
 * Sincronizador — o backend é a fonte de verdade e responde 403).
 *
 * 🔴 `validateSearch` declarado porque a tela de Consumo de Planos navega para cá com
 * `?competencia=YYYY-MM&comparar=1` (D12). Parâmetro emitido de um lado **sem** schema no
 * destino é descartado em silêncio, e o botão de lá pareceria funcionar
 * (`AP-FRONTEND-019`).
 *
 * `.catch(undefined)` nos dois campos: valor malformado é **ignorado** (a tela abre no
 * estado padrão) em vez de ser exibido cru ao usuário ou de derrubar a rota com um erro
 * que ninguém sabe ler.
 */
const searchSchema = z.object({
  /** `"YYYY-MM"` — o mesmo formato do `competencia` do backend. */
  competencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  /**
   * `"1"` abre a comparação já montada. Union literal em vez de `z.coerce.boolean()`:
   * a coerção do JS torna `"0"` **verdadeiro** (string não vazia), e `?comparar=0` abriria
   * a comparação — o oposto do que o link pediria.
   */
  comparar: z.literal('1').optional().catch(undefined),
})

const CompetenciasPage = lazyRouteComponent(
  () => import('../../features/billing-periods/index'),
)

export const Route = createFileRoute('/_auth/competencias')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!tokenStore.isValid()) {
      throw redirect({ to: '/login' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { competencia, comparar } = useSearch({ from: '/_auth/competencias' })
  return (
    <CompetenciasPage
      competenciaInicial={competencia ?? null}
      compararInicial={comparar === '1'}
    />
  )
}
