import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildCategoryColumns } from './columns'
import type { ServiceCategoryDto } from './types/serviceCategory'

const ativa: ServiceCategoryDto = { id: 7, nome: 'Consultoria', isActive: true }
const inativa: ServiceCategoryDto = { id: 9, nome: 'Plantão', isActive: false }

/**
 * 133 — três linhas com cardinalidade ASSIMÉTRICA (1 com a flag, 2 sem): num par 1×1 a
 * inversão do predicado (`!forca`) passaria, porque o conjunto de rótulos seria o mesmo.
 * A terceira linha vem sem a chave — o caso do backend anterior à 133.
 */
const comFlag: ServiceCategoryDto = {
  id: 21,
  nome: 'Consultoria',
  isActive: true,
  forcesBillableOutsidePlan: true,
}
const semFlag: ServiceCategoryDto = {
  id: 22,
  nome: 'Suporte',
  isActive: true,
  forcesBillableOutsidePlan: false,
}
const semChave: ServiceCategoryDto = { id: 23, nome: 'Legado', isActive: true }

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

/** Renderiza a célula da coluna 133 para uma linha. */
function renderCobranca(row: ServiceCategoryDto) {
  const columns = buildCategoryColumns({
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    isToggling: false,
    isDeleting: false,
  })
  const coluna = columns.find((c) => c.key === 'cobrancaForaDoPlano')
  if (!coluna) throw new Error('coluna "cobrancaForaDoPlano" não existe')
  return render(<>{coluna.accessor(row)}</>)
}

describe('buildCategoryColumns — coluna "Cobrança fora do plano" (133)', () => {
  it('a coluna existe, tem o cabeçalho da spec e fica entre "Categoria" e "Ativa"', () => {
    const columns = buildCategoryColumns({
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      isToggling: false,
      isDeleting: false,
    })

    // Identidade e POSIÇÃO do conjunto de colunas: vermelho se a coluna sumir, se for
    // renomeada, ou se nascer no fim da tabela.
    expect(columns.map((c) => c.key)).toEqual(['nome', 'cobrancaForaDoPlano', 'ativa', 'acao'])
    expect(columns[1].header).toBe('Cobrança fora do plano')
  })

  it('linha COM a flag exibe "Sempre"; linhas SEM exibem "Não" — as três na mesma execução', () => {
    // Cardinalidade assimétrica (1 × 2): com o predicado invertido o conjunto de rótulos
    // deixa de bater e o teste fica vermelho — o que NÃO aconteceria num par 1×1.
    const { container: c1 } = renderCobranca(comFlag)
    const { container: c2 } = renderCobranca(semFlag)
    const { container: c3 } = renderCobranca(semChave)

    expect(c1.textContent).toBe('Sempre')
    expect(c2.textContent).toBe('Não')
    // Backend anterior à 133: ausência nunca vira "undefined" na tela.
    expect(c3.textContent).toBe('Não')
  })

  it('a célula tem aria-label que nomeia a categoria e diz o estado por extenso', () => {
    // Vermelho se o rótulo perder o nome: o leitor de tela ouviria N células "Sempre"
    // idênticas, sem saber de qual categoria.
    renderCobranca(comFlag)
    expect(
      screen.getByLabelText('Consultoria: sempre cobrada fora do plano de suporte'),
    ).toBeInTheDocument()
  })

  it('companheira: a célula sem a flag tem o aria-label do estado OPOSTO', () => {
    renderCobranca(semFlag)
    expect(screen.getByLabelText('Suporte: não força cobrança fora do plano')).toBeInTheDocument()
  })

  it('a coluna é SOMENTE LEITURA — nenhum controle interativo na célula', () => {
    // Vermelho se alguém puser um Switch aqui: seria uma segunda via de escrita do mesmo
    // campo (`arquitetura.md` §4.3). A companheira é o teste do switch de "Ativa" abaixo,
    // que prova que a varredura por `switch`/`button` acha controles quando eles existem.
    const { container } = renderCobranca(comFlag)
    expect(container.querySelectorAll('button, input, [role="switch"]')).toHaveLength(0)
  })

  it('discriminador: a coluna "Ativa" CONTINUA tendo um switch (a varredura funciona)', () => {
    const columns = buildCategoryColumns({
      onToggle: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      isToggling: false,
      isDeleting: false,
    })
    const ativaCol = columns.find((c) => c.key === 'ativa')
    if (!ativaCol) throw new Error('coluna "ativa" não existe')
    const { container } = render(<>{ativaCol.accessor(comFlag)}</>)

    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(1)
  })
})

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
