import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildCategoryColumns } from './columns'
import type { ServiceCategoryDto } from './types/serviceCategory'

const ativa: ServiceCategoryDto = { id: 7, nome: 'Consultoria', isActive: true }
const inativa: ServiceCategoryDto = { id: 9, nome: 'Plantão', isActive: false }

type Handlers = {
  onToggle?: (c: ServiceCategoryDto) => void
  onEdit?: (c: ServiceCategoryDto) => void
  onDelete?: (c: ServiceCategoryDto) => void
  isToggling?: boolean
  isDeleting?: boolean
}

/** Renderiza a célula da coluna "Ação" para uma linha. */
function renderAcao(row: ServiceCategoryDto, handlers: Handlers = {}) {
  const columns = buildCategoryColumns({
    onToggle: handlers.onToggle ?? vi.fn(),
    onEdit: handlers.onEdit ?? vi.fn(),
    onDelete: handlers.onDelete ?? vi.fn(),
    isToggling: handlers.isToggling ?? false,
    isDeleting: handlers.isDeleting ?? false,
  })
  const acao = columns.find((c) => c.key === 'acao')
  if (!acao) throw new Error('coluna "acao" não existe')
  return render(<>{acao.accessor(row)}</>)
}

describe('buildCategoryColumns — ação de editar (123/FE-2)', () => {
  it('a linha oferece "editar" com aria-label que nomeia a categoria', () => {
    // Vermelho se o botão sumir da coluna ou perder o nome no rótulo (leitor de tela veria
    // N botões "editar" idênticos).
    renderAcao(ativa)
    expect(screen.getByRole('button', { name: 'Editar categoria Consultoria' })).toBeInTheDocument()
  })

  it('clicar em "editar" chama onEdit com a linha — e não onDelete', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderAcao(ativa, { onEdit, onDelete })

    await user.click(screen.getByRole('button', { name: 'Editar categoria Consultoria' }))

    // Vermelho se os dois botões forem trocados de handler — erro fácil e destrutivo
    // (clicar em "editar" abriria o diálogo de exclusão).
    expect(onEdit).toHaveBeenCalledWith(ativa)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('categoria INATIVA também pode ser renomeada (o backend não filtra por DesativadoEm)', () => {
    // Vermelho se alguém condicionar o botão a `row.isActive` — o UpdateAsync aceita
    // renomear categoria desativada (`ServiceCategoryService.cs:66-91`).
    renderAcao(inativa)
    expect(screen.getByRole('button', { name: 'Editar categoria Plantão' })).toBeEnabled()
  })

  it('"editar" NÃO é desabilitado por uma exclusão em andamento', () => {
    // `isDeleting` desabilita só "excluir". Vermelho se o disabled for colado nos dois.
    renderAcao(ativa, { isDeleting: true })
    expect(screen.getByRole('button', { name: 'Editar categoria Consultoria' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Excluir categoria Consultoria' })).toBeDisabled()
  })

  it('"excluir" continua existindo e chamando onDelete (não houve regressão)', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const onEdit = vi.fn()
    renderAcao(ativa, { onDelete, onEdit })

    await user.click(screen.getByRole('button', { name: 'Excluir categoria Consultoria' }))

    expect(onDelete).toHaveBeenCalledWith(ativa)
    expect(onEdit).not.toHaveBeenCalled()
  })
})
