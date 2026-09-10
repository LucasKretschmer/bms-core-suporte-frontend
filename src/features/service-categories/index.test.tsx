import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceCategoryDto } from './types/serviceCategory'

const {
  mockUsePermissions,
  mockUseServiceCategories,
  mockCreateMutate,
  mockUpdateMutateAsync,
  mockToggleMutate,
  mockRefetch,
  mockExportToCsv,
  mockExportToXlsx,
} = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
  mockUseServiceCategories: vi.fn(),
  mockCreateMutate: vi.fn(),
  mockUpdateMutateAsync: vi.fn(),
  mockToggleMutate: vi.fn(),
  mockRefetch: vi.fn(),
  mockExportToCsv: vi.fn(),
  mockExportToXlsx: vi.fn(),
}))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('./hooks/useServiceCategories', () => ({
  useServiceCategories: mockUseServiceCategories,
  SERVICE_CATEGORIES_QUERY_KEY: ['service-categories', { includeInactive: true }],
}))
/**
 * 133 - o export e espionado, **nao** reescrito: `reports/shared/utils/exportTable` e
 * territorio de outra demanda e este arquivo nao o edita. O mock existe so para ler as
 * colunas e as linhas que a tela entrega ao utilitario (`AP-FRONTEND-028`: o export e o
 * quarto lugar do campo, e o unico que sai do sistema).
 */
vi.mock('../reports/shared/utils/exportTable', () => ({
  exportToCsv: mockExportToCsv,
  exportToXlsx: mockExportToXlsx,
}))
vi.mock('./hooks/useCategoryMutations', () => ({
  useCategoryMutations: () => ({
    create: { mutate: mockCreateMutate, isPending: false },
    update: { mutateAsync: mockUpdateMutateAsync, isPending: false },
    toggleActive: { mutate: mockToggleMutate, isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
  }),
}))
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

import {
  classesDoTexto,
  fundoDoTexto,
  razaoDoTexto,
  reprovacoesAA,
  varrer,
} from '../../test/medidor-de-contraste'
import { chavesDeDuracao } from '../../test/duracaoExport'
import type { ExportColumn } from '../reports/shared/utils/exportTable'
import ServiceCategoriesPage from './index'

const categorias: ServiceCategoryDto[] = [
  { id: 7, nome: 'Consultoria', isActive: true },
  { id: 9, nome: 'Plantão', isActive: false },
]

/**
 * 133 - cardinalidade ASSIMETRICA (1 com a flag, 2 sem, sendo uma delas sem a chave):
 * num par 1x1 a inversao do predicado passaria.
 */
const categoriasComFlag: ServiceCategoryDto[] = [
  { id: 7, nome: 'Consultoria', isActive: true, forcesBillableOutsidePlan: true },
  { id: 9, nome: 'Plantão', isActive: false, forcesBillableOutsidePlan: false },
  { id: 11, nome: 'Legado', isActive: true },
]

function comLista(data: ServiceCategoryDto[]) {
  mockUseServiceCategories.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
  })
}

const GESTOR = { isCoordenadorOuAcima: true }
const ATENDENTE = { isCoordenadorOuAcima: false }

describe('ServiceCategoriesPage — permissão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    comLista(categorias)
  })

  it('ATENDENTE não vê a tela nem a ação de editar — barrado antes do 403', () => {
    // O PUT exige CoordenadorPlus (`ServiceCategoriesController.cs:68`). A UI precisa
    // barrar ANTES, senão o atendente clica e toma 403.
    // Vermelho se o early-return do gate sair: a tabela renderizaria e o botão "editar"
    // apareceria — é exatamente o par de asserções que distingue as duas situações.
    mockUsePermissions.mockReturnValue(ATENDENTE)
    render(<ServiceCategoriesPage />)

    expect(screen.getByText('Você não tem permissão para acessar esta área.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar categoria/ })).toBeNull()
  })

  it('gestor (CoordenadorPlus) vê "editar" em TODAS as linhas — companheira positiva', () => {
    mockUsePermissions.mockReturnValue(GESTOR)
    render(<ServiceCategoriesPage />)

    expect(screen.getByRole('button', { name: 'Editar categoria Consultoria' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar categoria Plantão' })).toBeInTheDocument()
  })
})

describe('ServiceCategoriesPage — renomear ponta a ponta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GESTOR)
    comLista(categorias)
  })

  it('clicar em "editar" abre o modal com o nome da LINHA clicada', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    await user.click(screen.getByRole('button', { name: 'Editar categoria Plantão' }))

    // Vermelho se o `setToEdit` receber a linha errada (ex.: sempre a primeira) — o
    // usuário renomearia a categoria errada sem perceber.
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome da categoria/)).toHaveValue('Plantão')
  })

  it('salvar dispara o PUT no ID da linha e fecha o modal', async () => {
    const user = userEvent.setup()
    mockUpdateMutateAsync.mockResolvedValue({ id: 9, nome: 'Plantão N2', isActive: false })
    render(<ServiceCategoriesPage />)

    await user.click(screen.getByRole('button', { name: 'Editar categoria Plantão' }))
    const campo = screen.getByLabelText(/Nome da categoria/)
    await user.clear(campo)
    await user.type(campo, 'Plantão N2')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    // `id: 9` é literal escrito à mão, não derivado da resposta — vermelho se o wiring
    // passar o índice, o id da primeira linha, ou um fallback tipo `?? 0`.
    // 133: o objeto inteiro e literal escrito a mao - a flag da linha ('Plantão' nao
    // forca) viaja junto e explicita, e o `id` nao pode vir de indice nem de fallback.
    await waitFor(() =>
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 9,
        nome: 'Plantão N2',
        forcesBillableOutsidePlan: false,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('o campo "Nova categoria" da toolbar não é afetado pelo modal (forms independentes)', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    await user.type(screen.getByLabelText('Nome da nova categoria'), 'Treinamento')
    await user.click(screen.getByRole('button', { name: 'Editar categoria Consultoria' }))

    expect(screen.getByLabelText(/Nome da categoria/)).toHaveValue('Consultoria')
    expect(screen.getByLabelText('Nome da nova categoria')).toHaveValue('Treinamento')
  })

  it('fechar o modal devolve o foco ao botão "editar" da linha (a11y)', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    const gatilho = screen.getByRole('button', { name: 'Editar categoria Consultoria' })
    await user.click(gatilho)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    // A prisão do foco é do `Modal`; a DEVOLUÇÃO é de quem abre (`useReturnFocus`) — dois
    // mecanismos, dois donos. Vermelho se `capture()`/`restore()` saírem do handler: o
    // foco ficaria no `body` e o usuário de teclado voltaria ao topo da página.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Editar categoria Consultoria' })).toHaveFocus(),
    )
  })

  it('renomear e excluir nunca abrem ao mesmo tempo (estados separados)', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    await user.click(screen.getByRole('button', { name: 'Editar categoria Consultoria' }))

    // Vermelho se um estado só (`selected`) passar a servir os dois overlays.
    expect(screen.queryByText(/Esta ação não pode ser desfeita/)).toBeNull()
  })
})

describe('ServiceCategoriesPage — estados de UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GESTOR)
  })

  it('loading: skeleton e nenhuma ação de editar', () => {
    mockUseServiceCategories.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    })
    render(<ServiceCategoriesPage />)

    expect(screen.queryByRole('button', { name: /Editar categoria/ })).toBeNull()
    expect(screen.queryByText('Nenhuma categoria cadastrada.')).toBeNull()
  })

  it('erro: ErrorState com retry que chama refetch', async () => {
    const user = userEvent.setup()
    mockUseServiceCategories.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    })
    render(<ServiceCategoriesPage />)

    expect(screen.getByText('Não foi possível carregar as categorias.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Tentar novamente/i }))
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('vazio: EmptyState em vez de tabela em branco', () => {
    comLista([])
    render(<ServiceCategoriesPage />)

    expect(screen.getByText('Nenhuma categoria cadastrada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar categoria/ })).toBeNull()
  })
})

/**
 * 133 - os dois elos da tela que o `AP-FRONTEND-028` diz que ficam para tras: o **export**
 * e o form de **criacao**.
 */
describe('ServiceCategoriesPage - flag de cobranca fora do plano (133)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GESTOR)
    comLista(categoriasComFlag)
  })

  describe('export CSV/XLSX', () => {
    it('CSV: a coluna existe no cabecalho E cada linha traz o rotulo certo', async () => {
      const user = userEvent.setup()
      render(<ServiceCategoriesPage />)

      await user.click(screen.getByRole('button', { name: 'Baixar CSV' }))

      const [, colunas, linhas] = mockExportToCsv.mock.calls[0]
      // Identidade do conjunto de colunas: vermelho se a coluna sumir, mudar de chave, ou
      // nascer com header diferente do da tabela.
      expect(colunas).toEqual([
        { header: 'Categoria', key: 'nome' },
        { header: 'Situação', key: 'situacao' },
        { header: 'Cobrança fora do plano', key: 'cobrancaForaDoPlano' },
      ])
      // Par positivo/negativo na MESMA execucao, com literais escritos a mao. Sem o par,
      // um mapeamento fixo em 'Nao' passaria.
      expect(linhas).toEqual([
        { nome: 'Consultoria', situacao: 'Ativa', cobrancaForaDoPlano: 'Sempre' },
        { nome: 'Plantão', situacao: 'Inativa', cobrancaForaDoPlano: 'Não' },
        { nome: 'Legado', situacao: 'Ativa', cobrancaForaDoPlano: 'Não' },
      ])
    })

    it('XLSX exporta EXATAMENTE as mesmas colunas e linhas do CSV', async () => {
      // A planilha e o formato que o gestor encaminha. Vermelho se so um dos dois caminhos
      // for atualizado - o erro classico de ter duas montagens de linha.
      const user = userEvent.setup()
      render(<ServiceCategoriesPage />)

      await user.click(screen.getByRole('button', { name: 'Baixar CSV' }))
      await user.click(screen.getByRole('button', { name: 'Baixar Excel' }))

      const [, colunasCsv, linhasCsv] = mockExportToCsv.mock.calls[0]
      const [, colunasXlsx, linhasXlsx] = mockExportToXlsx.mock.calls[0]
      expect(colunasXlsx).toEqual(colunasCsv)
      expect(linhasXlsx).toEqual(linhasCsv)
      // Literal, para que o par acima nao seja tautologia (expectativa derivada da propria
      // resposta prova so delegacao).
      expect(linhasXlsx[0]).toEqual({
        nome: 'Consultoria',
        situacao: 'Ativa',
        cobrancaForaDoPlano: 'Sempre',
      })
    })
  })

  describe('form de criacao', () => {
    const switchNovo = () => screen.getByRole('switch', { name: 'Cobrar sempre fora do plano' })

    it('nasce desligado e envia `false` explicito quando o usuario nao toca nele', async () => {
      const user = userEvent.setup()
      render(<ServiceCategoriesPage />)

      await user.type(screen.getByLabelText('Nome da nova categoria'), 'Treinamento')
      await user.click(screen.getByRole('button', { name: 'Adicionar' }))

      expect(switchNovo()).toHaveAttribute('aria-checked', 'false')
      await waitFor(() =>
        expect(mockCreateMutate).toHaveBeenCalledWith(
          { nome: 'Treinamento', forcesBillableOutsidePlan: false },
          expect.anything(),
        ),
      )
    })

    it('ligar o switch envia `true` - companheira positiva e prova de que ele escreve no form', async () => {
      const user = userEvent.setup()
      render(<ServiceCategoriesPage />)

      await user.type(screen.getByLabelText('Nome da nova categoria'), 'Consultoria')
      await user.click(switchNovo())
      expect(switchNovo()).toHaveAttribute('aria-checked', 'true')
      await user.click(screen.getByRole('button', { name: 'Adicionar' }))

      // Vermelho num switch decorativo (que nao chama `setValue`) - o caso anterior, com
      // `false`, passaria sozinho justamente nessa implementacao quebrada.
      await waitFor(() =>
        expect(mockCreateMutate).toHaveBeenCalledWith(
          { nome: 'Consultoria', forcesBillableOutsidePlan: true },
          expect.anything(),
        ),
      )
    })

    it('o reset do sucesso repoe os DOIS campos - o switch nao fica ligado para a proxima', async () => {
      const user = userEvent.setup()
      // O `create.mutate` real chama `onSuccess` do 2o argumento; aqui o mock o executa.
      mockCreateMutate.mockImplementation(
        (_values: unknown, opcoes?: { onSuccess?: () => void }) => opcoes?.onSuccess?.(),
      )
      render(<ServiceCategoriesPage />)

      await user.type(screen.getByLabelText('Nome da nova categoria'), 'Consultoria')
      await user.click(switchNovo())
      await user.click(screen.getByRole('button', { name: 'Adicionar' }))

      // Vermelho se o `reset` repuser so o nome: a proxima categoria digitada nasceria
      // com a flag ligada sem ninguem pedir.
      await waitFor(() => expect(screen.getByLabelText('Nome da nova categoria')).toHaveValue(''))
      expect(switchNovo()).toHaveAttribute('aria-checked', 'false')
    })

    it('o texto de apoio explica o efeito, visivel na tela (nao em tooltip)', () => {
      render(<ServiceCategoriesPage />)
      expect(screen.getByText(/o atendente não poderá desmarcar/)).toBeInTheDocument()
    })

    it('o apoio esta associado ao switch por aria-describedby (id REAL, nao presenca)', () => {
      // Vermelho se o id do `<p>` e o do `aria-describedby` deixarem de vir da mesma
      // constante: o atributo continuaria la, apontando para o nada, e o leitor de tela
      // nao anunciaria o efeito da flag.
      render(<ServiceCategoriesPage />)

      const apoio = screen.getByText(/o atendente não poderá desmarcar/)
      expect(apoio.id).not.toBe('')
      expect(switchNovo()).toHaveAttribute('aria-describedby', apoio.id)
    })
  })

  /**
   * 133 - contraste dos textos NOVOS desta tela, medidos no DOM renderizado (nao na classe
   * escrita no JSX: quando o texto passa por componente compartilhado, a classe interna do
   * filho vence a de fora). AA e piso, nao preferencia (`rules/frontend.md`).
   */
  describe('contraste dos textos da flag', () => {
    it('rotulo, apoio e a coluna "Sempre"/"Nao" passam AA sobre o fundo real', () => {
      const { container } = render(<ServiceCategoriesPage />)
      const { medidas, pulados } = varrer(container)

      // `pulados` vazio: um medidor que descarta em silencio devolveria "0 reprovacoes".
      expect(pulados).toEqual([])
      // `razaoDoTexto` LANCA quando a frase nao foi medida - e o que impede este teste de
      // ficar verde por vacuidade caso o texto suma da tela.
      // O trecho e o PREFIXO medido: o medidor trunca o texto em 60 caracteres, e uma
      // frase mais longa nunca casaria - o teste ficaria verde por vacuidade se
      // `razaoDoTexto` nao lancasse quando nada casa.
      const APOIO = 'Apontamentos com esta categoria serão sempre marcados'

      // Apoio do form de criacao: fundo da PAGINA (#f0f4f7), nao do card.
      expect(classesDoTexto(medidas, APOIO)).toEqual(['text-foreground/70'])
      expect(fundoDoTexto(medidas, APOIO)).toEqual(['#f0f4f7'])
      expect(razaoDoTexto(medidas, APOIO).toFixed(2)).toBe('5.20')
      // Rotulo visivel do switch (nao e so aria-label - `disabled`/rotulo mudo reprova a11y).
      expect(classesDoTexto(medidas, 'Cobrar sempre fora do plano')).toEqual(['text-foreground'])
      expect(razaoDoTexto(medidas, 'Cobrar sempre fora do plano').toFixed(2)).toBe('12.50')
      // A coluna, sobre o card branco: o par 'Sempre' (foreground) e 'Não' (foreground/70).
      expect(classesDoTexto(medidas, 'Não')).toEqual(['text-foreground/70'])
      expect(fundoDoTexto(medidas, 'Não')).toEqual(['#ffffff'])
      expect(razaoDoTexto(medidas, 'Não').toFixed(2)).toBe('5.47')
      expect(razaoDoTexto(medidas, 'Sempre').toFixed(2)).toBe('13.82')
      expect(reprovacoesAA(medidas)).toEqual([])
    })
  })

  describe('tabela', () => {
    it('a coluna aparece com o par Sempre/Nao - 1 com a flag, 2 sem', () => {
      render(<ServiceCategoriesPage />)

      // Assimetria: com o predicado invertido viriam 2 "Sempre" e 1 "Nao".
      expect(screen.getAllByText('Sempre')).toHaveLength(1)
      expect(screen.getAllByText('Não')).toHaveLength(2)
      expect(screen.getByText('Cobrança fora do plano')).toBeInTheDocument()
    })
  })
})

/**
 * 134 · U9 — veredito "SEM duração" (análise §1.2).
 *
 * Categorias de Atendimento exporta Categoria · Situação · Cobrança fora do plano: nenhum
 * campo de tempo. O veredito é travado aqui para não regredir em silêncio.
 *
 * 🔴 `toEqual([])` é asserção negativa e seria satisfeita pelo vazio (`rules/tests.md`
 * § padrão 1): passaria se o clique não tivesse exportado nada, se as colunas viessem `[]`
 * ou se `chavesDeDuracao` estivesse morta. Daí as duas positivas na MESMA execução —
 * identidade literal das colunas reais (P1) e detector provado vivo sobre essa mesma
 * lista (P2).
 */
describe('ServiceCategoriesPage — veredito "sem duração" no export (134)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GESTOR)
    comLista(categoriasComFlag)
  })

  it('nenhuma das colunas do CSV/XLSX é de duração', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    await user.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await user.click(screen.getByRole('button', { name: 'Baixar Excel' }))

    const colunasCsv = mockExportToCsv.mock.calls[0][1] as ExportColumn[]
    const colunasXlsx = mockExportToXlsx.mock.calls[0][1] as ExportColumn[]

    // P1 · positiva com literal à mão: a superfície REAL chegou ao utilitário de export.
    // Vermelho se uma coluna nascer, sumir ou mudar de chave — inclusive uma de tempo.
    expect(colunasCsv.map((c) => c.key)).toEqual(['nome', 'situacao', 'cobrancaForaDoPlano'])
    expect(colunasXlsx.map((c) => c.key)).toEqual(['nome', 'situacao', 'cobrancaForaDoPlano'])

    // P2 · o detector DISCRIMINA: marcadas, estas mesmas colunas voltam não-vazias.
    // Vermelho se `chavesDeDuracao` passar a devolver sempre `[]` (o que tornaria o
    // veredito abaixo inerte).
    const marcadas = colunasCsv.map((c) => ({ ...c, type: 'duration' as const }))
    expect(chavesDeDuracao(marcadas)).toEqual(['nome', 'situacao', 'cobrancaForaDoPlano'])

    // VEREDITO · vermelho se alguém marcar qualquer coluna daqui como duração sem passar
    // pelo inventário da demanda (R8 da análise: a decisão passa a ser explícita).
    expect(chavesDeDuracao(colunasCsv)).toEqual([])
    expect(chavesDeDuracao(colunasXlsx)).toEqual([])
  })
})
