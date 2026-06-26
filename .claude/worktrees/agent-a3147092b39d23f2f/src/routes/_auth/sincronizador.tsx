import { createFileRoute } from '@tanstack/react-router'
import SincronizadorPage from '../../features/sincronizador/index'

/**
 * Rota autenticada do Sincronizador HubSpot.
 * Proteção de token em _auth.tsx (beforeLoad).
 * Proteção de role (isGerentePlus) feita na própria SincronizadorPage —
 * mesmo padrão adotado nos dashboards de suporte.
 */
export const Route = createFileRoute('/_auth/sincronizador')({
  component: SincronizadorPage,
})
