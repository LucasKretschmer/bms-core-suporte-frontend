/**
 * 134 · U9 — veredito "SEM duração" do export de Equipes e Atendentes (análise §1.2).
 *
 * A superfície exporta Atendente · E-mail · Equipes · Perfil: **tudo texto**, nenhum campo
 * de tempo. Este arquivo trava o veredito para que ele não regrida em silêncio (R8 da
 * análise: se um dia nascer uma coluna de tempo aqui, a decisão passa a ser explícita).
 *
 * 🔴 `toEqual([])` é asserção negativa e asserção negativa é satisfeita pelo vazio
 * (`rules/tests.md` § padrão 1): ela passaria se o clique não tivesse exportado nada, se
 * as colunas chegassem `[]`, ou se `chavesDeDuracao` estivesse morta. Por isso cada
 * veredito vem com DUAS positivas na mesma execução:
 *   (P1) identidade literal das colunas REAIS que a tela entrega ao utilitário;
 *   (P2) o mesmo detector, sobre essa MESMA lista com as colunas marcadas, devolvendo
 *        não-vazio — prova de que ele discrimina.
 *
 * Arquivo separado de `columns.test.tsx` (que cobre a tabela visível) porque o sujeito
 * aqui é outro: a coluna do ARQUIVO baixado.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentDto } from './types/team'

const { mockUsePermissions, mockUseTeamMembers, mockUseAuth, mockExportToCsv, mockExportToXlsx } =
  vi.hoisted(() => ({
    mockUsePermissions: vi.fn(),
    mockUseTeamMembers: vi.fn(),
    mockUseAuth: vi.fn(),
    mockExportToCsv: vi.fn(),
    mockExportToXlsx: vi.fn(),
  }))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: mockUseAuth }))
vi.mock('./hooks/useTeamMembers', () => ({
  useTeamMembers: mockUseTeamMembers,
  TEAM_MEMBERS_QUERY_KEY: ['team-members'],
}))
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))
// A célula de papel depende de mutation (QueryClient) e não tem nada a ver com o export.
vi.mock('./components/AgentRoleCell', () => ({
  AgentRoleCell: () => <span data-testid="agent-role-cell" />,
}))
/**
 * O export é **espionado**, não reescrito: `reports/shared/utils/exportTable` é território
 * da unidade U0 desta mesma demanda e este arquivo não o edita. O mock existe só para ler
 * as colunas que a tela entrega ao utilitário.
 */
vi.mock('../reports/shared/utils/exportTable', () => ({
  exportToCsv: mockExportToCsv,
  exportToXlsx: mockExportToXlsx,
}))

import { chavesDeDuracao } from '../../test/duracaoExport'
import type { ExportColumn } from '../reports/shared/utils/exportTable'
import TeamsPage from './index'

/** Identidade literal das colunas do arquivo, na ordem em que saem. Escrita à mão. */
const CHAVES_ESPERADAS = ['nome', 'email', 'equipe', 'papel']

const atendentes: AgentDto[] = [
  {
    userId: 1,
    nome: 'Ana',
    email: 'ana@migrate.info',
    equipeId: 5,
    equipeNome: 'Suporte',
    papel: 'ATENDENTE',
    equipes: [{ id: 5, nome: 'Suporte', isPrimary: true }],
  },
  {
    userId: 2,
    nome: 'Bruno',
    email: null,
    equipeId: null,
    equipeNome: null,
    papel: 'COORDENADOR',
    equipes: [],
  },
]

describe('TeamsPage — veredito "sem duração" no export (134)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue({ isCoordenadorOuAcima: true, isGerentePlus: true })
    mockUseAuth.mockReturnValue({ user: { id: 1 } })
    mockUseTeamMembers.mockReturnValue({
      data: atendentes,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it('nenhuma das colunas do CSV/XLSX é de duração', async () => {
    const user = userEvent.setup()
    render(<TeamsPage />)

    await user.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await user.click(screen.getByRole('button', { name: 'Baixar Excel' }))

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

  it('as células exportadas são TEXTO — nenhum total de tempo escondido', async () => {
    const user = userEvent.setup()
    render(<TeamsPage />)

    await user.click(screen.getByRole('button', { name: 'Baixar CSV' }))

    const [, , linhas] = mockExportToCsv.mock.calls[0]
    // Literais à mão (cardinalidade assimétrica de equipes: 1 e 0) — é o porquê do
    // veredito, não só o veredito. Vermelho se alguma célula virar número de segundos.
    expect(linhas).toEqual([
      { nome: 'Ana', email: 'ana@migrate.info', equipe: 'Suporte', papel: 'ATENDENTE' },
      { nome: 'Bruno', email: '—', equipe: '—', papel: 'COORDENADOR' },
    ])
  })
})
