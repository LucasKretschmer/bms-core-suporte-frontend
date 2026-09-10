/**
 * 134 · U9 — veredito "SEM duração" do export de Movimentação Diária (análise §1.2, C1).
 *
 * O PRD §3 mandava "verificar" esta superfície. A análise verificou: as colunas são
 * Data · Status · Equipe · **Quantidade** · Última atualização. `Quantidade` é
 * **contagem** de tickets (PRD §2.4), e `Data`/`Última atualização` são **instantes** —
 * nenhuma duração. É o veredito que este arquivo trava.
 *
 * 🔴 `toEqual([])` é asserção negativa, satisfeita pelo vazio (`rules/tests.md` § padrão 1):
 * passaria se o export não tivesse rodado, se as colunas chegassem `[]`, ou se
 * `chavesDeDuracao` estivesse morta. Daí as duas positivas na MESMA execução — identidade
 * literal das colunas reais (P1) e detector provado vivo sobre essa mesma lista (P2).
 *
 * ⚠️ `Quantidade` é o caso interessante: é a única célula **numérica** das 5 superfícies
 * sem duração. Um `type: 'duration'` posto nela transformaria "37 tickets" em "37 segundos"
 * (`00:00:37`) na planilha — perda silenciosa de sentido. O veredito abaixo é o que barra.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MovimentacaoDiariaRowDto } from './types/movimentacaoDiaria'
import type { PaginatedResponse } from '../../types/api'

const { mockUseLogs, mockListMovimentacaoDiaria, mockExportToCsv, mockExportToXlsx } = vi.hoisted(
  () => ({
    mockUseLogs: vi.fn(),
    mockListMovimentacaoDiaria: vi.fn(),
    mockExportToCsv: vi.fn(),
    mockExportToXlsx: vi.fn(),
  }),
)

vi.mock('./hooks/useMovimentacaoDiariaLogs', () => ({
  useMovimentacaoDiariaLogs: mockUseLogs,
  buildScope: () => ({ tipo: 'todos' }),
}))
vi.mock('./services/movimentacaoDiariaService', () => ({
  listMovimentacaoDiaria: mockListMovimentacaoDiaria,
}))
// O combobox de equipes faz `useQuery` própria e não tem relação com o export.
vi.mock('../reports/shared/components/TeamCombobox', () => ({
  TeamCombobox: () => <div data-testid="team-combobox" />,
}))
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))
/**
 * O export é **espionado**, não reescrito: `reports/shared/utils/exportTable` é território
 * da unidade U0 desta mesma demanda e este arquivo não o edita. `fetchAllPaginated` fica
 * REAL — é ele que agrega o conjunto filtrado que vai para o arquivo.
 */
vi.mock('../reports/shared/utils/exportTable', () => ({
  exportToCsv: mockExportToCsv,
  exportToXlsx: mockExportToXlsx,
}))

import { chavesDeDuracao } from '../../test/duracaoExport'
import type { ExportColumn } from '../reports/shared/utils/exportTable'
import MovimentacaoDiariaPage from './index'

/** Identidade literal das colunas do arquivo, na ordem em que saem. Escrita à mão. */
const CHAVES_ESPERADAS = ['data', 'status', 'equipe', 'quantidade', 'atualizadoEm']

/** Cardinalidade assimétrica de propósito (37 × 4): um mapeamento fixo não passaria. */
const linhasDoBackend: MovimentacaoDiariaRowDto[] = [
  {
    id: 1,
    data: '2026-05-04',
    statusBucket: 'aberto',
    statusLabel: 'Aguardando cliente',
    equipeId: 5,
    equipe: 'Suporte',
    quantidade: 37,
    atualizadoEm: '2026-05-04T13:30:00Z',
  },
  {
    id: 2,
    data: '2026-05-04',
    statusBucket: 'novos',
    equipeId: null,
    equipe: null,
    quantidade: 4,
    atualizadoEm: '2026-05-04T13:30:00Z',
  },
]

function paginaUnica(items: MovimentacaoDiariaRowDto[]): PaginatedResponse<MovimentacaoDiariaRowDto> {
  return { items, totalCount: items.length, page: 1, pageSize: 200, totalPages: 1 }
}

describe('MovimentacaoDiariaPage — veredito "sem duração" no export (134)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListMovimentacaoDiaria.mockResolvedValue(paginaUnica(linhasDoBackend))
    mockUseLogs.mockReturnValue({
      data: paginaUnica(linhasDoBackend),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      sortBy: 'data',
      sortDirection: 'desc',
      filters: { from: null, to: null, equipeId: null, statusBucket: [], search: '' },
      setPage: vi.fn(),
      setPageSize: vi.fn(),
      setSort: vi.fn(),
      setFilters: vi.fn(),
    })
  })

  it('nenhuma das colunas do CSV/XLSX é de duração', async () => {
    const user = userEvent.setup()
    render(<MovimentacaoDiariaPage />)

    await user.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await vi.waitFor(() => expect(mockExportToCsv).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Baixar Excel' }))
    await vi.waitFor(() => expect(mockExportToXlsx).toHaveBeenCalledTimes(1))

    const colunasCsv = mockExportToCsv.mock.calls[0][1] as ExportColumn[]
    const colunasXlsx = mockExportToXlsx.mock.calls[0][1] as ExportColumn[]

    // P1 · a superfície REAL chegou ao utilitário. Vermelho se uma coluna nascer, sumir ou
    // mudar de chave — inclusive uma coluna de tempo.
    expect(colunasCsv.map((c) => c.key)).toEqual(CHAVES_ESPERADAS)
    expect(colunasXlsx.map((c) => c.key)).toEqual(CHAVES_ESPERADAS)

    // P2 · o detector DISCRIMINA sobre esta mesma lista. Vermelho se `chavesDeDuracao`
    // passar a devolver sempre `[]` — o modo de falha que tornaria o veredito inerte.
    expect(chavesDeDuracao(colunasCsv.map((c) => ({ ...c, type: 'duration' as const })))).toEqual(
      CHAVES_ESPERADAS,
    )

    // VEREDITO
    expect(chavesDeDuracao(colunasCsv)).toEqual([])
    expect(chavesDeDuracao(colunasXlsx)).toEqual([])
  })

  it('`Quantidade` é CONTAGEM e `Data`/`Última atualização` são INSTANTES', async () => {
    const user = userEvent.setup()
    render(<MovimentacaoDiariaPage />)

    await user.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await vi.waitFor(() => expect(mockExportToCsv).toHaveBeenCalledTimes(1))

    const [, , linhas] = mockExportToCsv.mock.calls[0]
    // Literais escritos à mão — é o porquê do veredito, não só o veredito. Vermelho se
    // `quantidade` deixar de ser a contagem crua (37/4) ou se as datas virarem durações.
    expect(linhas[0].quantidade).toBe(37)
    expect(linhas[1].quantidade).toBe(4)
    expect(linhas[0].data).toBe('04/05/2026')
    expect(linhas[0].status).toBe('Aguardando cliente')
    expect(linhas[1].status).toBe('Novos')
    expect(linhas[1].equipe).toBe('Sem equipe')
  })
})
