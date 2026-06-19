import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Raiz autenticada — redireciona para o Dashboard de Suporte.
 * Fase 0: stub de redirecionamento. Não editar na Fase 1.
 */
export const Route = createFileRoute('/_auth/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboards/suporte' })
  },
  component: () => null,
})
