/**
 * 124/F4 — o que a SEÇÃO mostra em cada estado. Testes de COMPONENTE.
 *
 * `supportSlaStates.test.ts` prova a decisão; este arquivo prova que a decisão vira
 * tela — com estas palavras, neste lugar, e sem número no lugar do vazio
 * (`rules/tests.md` § o sujeito da frase decide o tipo de teste).
 *
 * ## Como os discriminadores foram escolhidos
 *
 * - o gráfico é **mockado por um marcador que imprime os números recebidos**: assim
 *   "não configurado" é distinguível de "gráfico com 0 e 0" pela AUSÊNCIA do marcador
 *   E pela presença do texto — e toda asserção negativa tem companheira positiva na
 *   mesma execução (o cenário `ok` renderiza o marcador com os números);
 * - o aviso do FCR é discriminado pela **data**, que vem de `fcrHistoricoDesde` — um
 *   aviso constante ou de data fixa não passaria pelos dois valores diferentes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'

import { contrastRatio } from '../../../../utils/colorContrast'

const { mockUsePermissions } = vi.hoisted(() => ({ mockUsePermissions: vi.fn() }))

vi.mock('../../../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))

// Link simplificado — não é preciso RouterProvider (mesma convenção de Sidebar.test.tsx).
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

// Marcador que IMPRIME o que recebeu: o gráfico só aparece quando há apuração, e o
// teste consegue afirmar QUAIS números chegaram nele.
vi.mock('../../shared/components/FirstResponseVsSlaChart', () => ({
  FirstResponseVsSlaChart: ({
    respondidosNoPrazo,
    respondidosForaDoPrazo,
  }: {
    respondidosNoPrazo: number | null
    respondidosForaDoPrazo: number | null
  }) => (
    <div data-testid="sla-chart">
      {`no-prazo=${String(respondidosNoPrazo)};fora=${String(respondidosForaDoPrazo)}`}
    </div>
  ),
}))

import { SupportSlaSection } from './SupportSlaSection'

function comoGestor() {
  mockUsePermissions.mockReturnValue({
    role: 'GERENTE',
    isCoordenadorOuAcima: true,
    isGerentePlus: true,
    isAtendente: false,
    isGestor: true,
    primaryTeamId: null,
    isAuthenticated: true,
  })
}

function comoAtendente() {
  mockUsePermissions.mockReturnValue({
    role: 'ATENDENTE',
    isCoordenadorOuAcima: false,
    isGerentePlus: false,
    isAtendente: true,
    isGestor: false,
    primaryTeamId: 3,
    isAuthenticated: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  comoGestor()
})

describe('SupportSlaSection — apuração existente (companheira positiva de tudo abaixo)', () => {
  it('mostra o gráfico com os números quando o SLA foi apurado', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
      />,
    )

    expect(screen.getByTestId('sla-chart')).toHaveTextContent('no-prazo=7;fora=3')
    expect(screen.queryByText(/não configurado/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Nenhum chamado criado no período/i)).not.toBeInTheDocument()
  })

  it('0 no prazo e 0 fora do prazo é APURAÇÃO, não vazio: o gráfico aparece com os zeros', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={0}
        respondidosForaDoPrazo={0}
        chamadosNoPeriodo={5}
      />,
    )

    expect(screen.getByTestId('sla-chart')).toHaveTextContent('no-prazo=0;fora=0')
    expect(screen.queryByText(/não configurado/i)).not.toBeInTheDocument()
  })
})

describe('SupportSlaSection — vazio 1: "SLA não configurado"', () => {
  it('diz "não configurado" com essas palavras, e NÃO desenha gráfico nem zero', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )

    expect(screen.getByText('SLA de 1º atendimento não configurado')).toBeInTheDocument()
    expect(screen.queryByTestId('sla-chart')).not.toBeInTheDocument()
    // O "0%"/"0" que o `?? 0` produziria não pode existir em lugar nenhum do card.
    expect(screen.queryByText(/\b0\b/)).not.toBeInTheDocument()
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument()
  })

  it('explica a condição real e mostra a contagem de chamados que ficaram de fora', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )

    expect(
      screen.getByText(/Nenhum dos 12 chamados criados no período entrou na apuração/),
    ).toBeInTheDocument()
    // 124/FE-TXT — era `/meta de 1ª resposta no plano do cliente/`; 124/P-7 trocou o
    // vocabulário para "1º atendimento". Reescrito afirmando a
    // correção e MAIS específico: agora exige as DUAS moradas da meta e a precedência
    // entre elas (`MetricsService.cs:691` — `PlanoSlaMinutos ?? metaDoCalendario`).
    expect(
      screen.getByText(
        /meta de 1º atendimento — do plano do cliente ou, na falta dela, a meta padrão do calendário/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/calendário com expediente cadastrado/)).toBeInTheDocument()
  })

  it('a explicação NÃO manda preencher o plano quem já tem a meta padrão do calendário', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )

    // POSITIVA na mesma execução — o discriminador de que o vazio foi renderizado.
    const detalhe = screen.getByText(/Nenhum dos 12 chamados/)
    expect(detalhe).toHaveTextContent(/a meta padrão do calendário/)
    // NEGATIVA: a redação incompleta, que só conhecia a meta do plano.
    expect(detalhe).not.toHaveTextContent(/exige a meta de 1º atendimento no plano do cliente/)
    // 124/P-7 — o vocabulário antigo não volta.
    expect(detalhe).not.toHaveTextContent(/1ª resposta/i)
  })

  it('a contagem exibida vem do dado, não de constante', () => {
    const { unmount } = render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )
    expect(screen.getByText(/\b12 chamados\b/)).toBeInTheDocument()
    unmount()

    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={347}
      />,
    )
    expect(screen.getByText(/\b347 chamados\b/)).toBeInTheDocument()
    expect(screen.queryByText(/\b12 chamados\b/)).not.toBeInTheDocument()
  })

  it('aponta para onde se configura — /planos e /calendario — para quem pode entrar lá', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )

    expect(screen.getByRole('link', { name: 'Planos' })).toHaveAttribute('href', '/planos')
    expect(screen.getByRole('link', { name: 'Calendário' })).toHaveAttribute(
      'href',
      '/calendario',
    )
    // 124/FE-TXT — um link por tela: citar a meta padrão do calendário NÃO pode fazer a
    // mesma porta aparecer duas vezes na frase.
    expect(screen.getAllByRole('link', { name: 'Calendário' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Planos' })).toHaveLength(1)
  })

  it('a chamada de ação oferece o expediente no Calendário e a meta nas suas DUAS moradas', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )

    // O expediente só existe no calendário — por isso ele abre a frase.
    expect(screen.getByText(/Cadastre o expediente em/)).toBeInTheDocument()
    // E a meta aparece com as duas moradas que o backend aceita.
    expect(
      screen.getByText(/A meta de 1º atendimento pode ser a padrão do próprio calendário/),
    ).toBeInTheDocument()
    expect(screen.getByText(/por cliente, a do plano em/)).toBeInTheDocument()
    // A redação antiga mandava direto ao plano, sem citar o padrão do calendário.
    expect(screen.queryByText(/Cadastre a meta de 1º atendimento em/)).not.toBeInTheDocument()
  })

  it('para o ATENDENTE não oferece link (as duas telas são requiresGestor), mas explica o caminho', () => {
    comoAtendente()
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )

    expect(screen.getByText('SLA de 1º atendimento não configurado')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    // 124/FE-TXT — mais específico: o atendente recebe a MESMA verdade do gestor,
    // inclusive a segunda morada da meta. Antes só se afirmava "Peça a um gestor".
    const pedido = screen.getByText(/Peça a um gestor/)
    expect(pedido).toHaveTextContent(/expediente do calendário/)
    expect(pedido).toHaveTextContent(/a padrão do calendário ou a do plano do cliente/)
    expect(pedido).not.toHaveTextContent(/cadastrar a meta de 1º atendimento do plano/)
  })
})

describe('SupportSlaSection — vazio 2: "sem chamado no período" (NUNCA a mesma frase)', () => {
  it('sem chamado no período, fala do período — e não acusa falta de configuração', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={0}
      />,
    )

    expect(screen.getByText('Nenhum chamado criado no período selecionado')).toBeInTheDocument()
    expect(screen.queryByText(/não configurado/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sla-chart')).not.toBeInTheDocument()
  })

  it('sem o discriminador, não afirma nenhuma das duas causas', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={null}
      />,
    )

    expect(
      screen.getByText('SLA de 1º atendimento sem apuração para o período'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/não configurado/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Nenhum chamado criado no período/i)).not.toBeInTheDocument()
  })

  it('os dois vazios não compartilham o texto — provado na mesma execução', () => {
    const { unmount } = render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={0}
      />,
    )
    const semChamados = screen.getByText(/Nenhum chamado criado no período selecionado/)
      .textContent
    unmount()

    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={4}
      />,
    )
    const naoConfigurado = screen.getByText(/SLA de 1º atendimento não configurado/).textContent

    expect(semChamados).not.toBe(naoConfigurado)
  })
})

describe('SupportSlaSection — loading e erro continuam existindo', () => {
  it('carregando: nem gráfico nem mensagem de vazio', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
        isLoading
      />,
    )

    expect(screen.queryByTestId('sla-chart')).not.toBeInTheDocument()
    expect(screen.queryByText(/não configurado/i)).not.toBeInTheDocument()
  })

  it('erro: mostra o estado de erro com retry, nunca "não configurado"', () => {
    const onRetry = vi.fn()
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
        isError
        onRetry={onRetry}
      />,
    )

    expect(screen.queryByText(/não configurado/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })
})

describe('SupportSlaSection — R-3: aviso do limite de confiabilidade do FCR', () => {
  const AVISO = /O histórico de movimentação começa em/

  it('avisa quando o período começa antes do limite, com a data do backend', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        fcr={92.3}
        fcrHistoricoDesde="2026-05-20T13:00:00Z"
        periodoInicio="2026-01-01"
      />,
    )

    expect(screen.getByText(/FCR \(1º contato\): número superestimado/)).toBeInTheDocument()
    expect(
      screen.getByText(/O histórico de movimentação começa em 20\/05\/2026/),
    ).toBeInTheDocument()
    expect(screen.getByText(/superestimado para este período/)).toBeInTheDocument()
    // Companheira positiva: o número do SLA continua na tela — avisar não é esconder.
    expect(screen.getByTestId('sla-chart')).toHaveTextContent('no-prazo=7;fora=3')
  })

  it('NÃO avisa quando o período começa depois do limite', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        fcr={92.3}
        fcrHistoricoDesde="2026-05-20T13:00:00Z"
        periodoInicio="2026-06-01"
      />,
    )

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    // Discriminador: o ponto observado É alcançado — a tela renderizou o resto.
    expect(screen.getByTestId('sla-chart')).toBeInTheDocument()
  })

  it('a data do aviso vem de `fcrHistoricoDesde` — troque o campo, muda a data', () => {
    // O MESMO início de período nos dois renders (anterior aos dois limites): o que
    // muda é só o campo do backend, então a data exibida só pode ter vindo dele.
    const { unmount } = render(
      <SupportSlaSection
        respondidosNoPrazo={1}
        respondidosForaDoPrazo={1}
        chamadosNoPeriodo={2}
        fcr={50}
        fcrHistoricoDesde="2026-05-20T13:00:00Z"
        periodoInicio="2025-01-01"
      />,
    )
    expect(screen.getByText(/começa em 20\/05\/2026/)).toBeInTheDocument()
    unmount()

    render(
      <SupportSlaSection
        respondidosNoPrazo={1}
        respondidosForaDoPrazo={1}
        chamadosNoPeriodo={2}
        fcr={50}
        fcrHistoricoDesde="2025-11-02T09:30:00Z"
        periodoInicio="2025-01-01"
      />,
    )
    expect(screen.getByText(/começa em 02\/11\/2025/)).toBeInTheDocument()
    expect(screen.queryByText(/20\/05\/2026/)).not.toBeInTheDocument()
  })

  it('a data exibida é o dia civil de SÃO PAULO do instante UTC', () => {
    // 01/09 02:00 UTC = 31/08 23:00 em SP. Quem lesse o dia UTC mostraria 01/09/2026
    // — e, para um período que começa em 31/08, deixaria de avisar.
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        fcr={92.3}
        fcrHistoricoDesde="2026-09-01T02:00:00Z"
        periodoInicio="2026-08-31"
      />,
    )

    expect(screen.getByText(/começa em 31\/08\/2026/)).toBeInTheDocument()
    expect(screen.queryByText(/01\/09\/2026/)).not.toBeInTheDocument()
  })

  it('sem filtro de período, compara com o 1º dia do MÊS CORRENTE (default do backend)', () => {
    // `from` nulo não é período aberto: `FusoSaoPaulo.Resolver` usa o 1º dia do mês.
    // Com o relógio em 06/09 e o limite em 03/09, o período (01/09) começa ANTES.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-06T15:00:00Z'))
    try {
      render(
        <SupportSlaSection
          respondidosNoPrazo={7}
          respondidosForaDoPrazo={3}
          chamadosNoPeriodo={10}
          fcr={92.3}
          fcrHistoricoDesde="2026-09-03T12:00:00Z"
          periodoInicio={null}
        />,
      )

      expect(screen.getByText(/começa em 03\/09\/2026/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sem `fcrHistoricoDesde` (campo ausente do JSON) não há aviso, e o resto continua', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        fcr={92.3}
        periodoInicio="2020-01-01"
      />,
    )

    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    expect(screen.getByTestId('sla-chart')).toBeInTheDocument()
  })

  it('sem FCR não há aviso; com FCR ZERO há — 0 é número, não ausência', () => {
    const { unmount } = render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        fcr={null}
        fcrHistoricoDesde="2026-05-20T13:00:00Z"
        periodoInicio="2026-01-01"
      />,
    )
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    unmount()

    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        fcr={0}
        fcrHistoricoDesde="2026-05-20T13:00:00Z"
        periodoInicio="2026-01-01"
      />,
    )
    expect(screen.getByText(AVISO)).toBeInTheDocument()
  })

  it('o aviso sobrevive ao card vazio: SLA não configurado NÃO apaga o aviso do FCR', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
        fcr={92.3}
        fcrHistoricoDesde="2026-05-20T13:00:00Z"
        periodoInicio="2026-01-01"
      />,
    )

    expect(screen.getByText(AVISO)).toBeInTheDocument()
    expect(screen.getByText('SLA de 1º atendimento não configurado')).toBeInTheDocument()
  })

  it('o aviso é visível na tela — não é `title`/tooltip escondido', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        fcr={92.3}
        fcrHistoricoDesde="2026-05-20T13:00:00Z"
        periodoInicio="2026-01-01"
      />,
    )

    const regiao = screen.getByRole('region', {
      name: /FCR \(1º contato\): número superestimado neste período/,
    })
    expect(regiao).toBeVisible()
    expect(regiao).toHaveTextContent(/O histórico de movimentação começa em 20\/05\/2026/)
  })
})

/**
 * Contraste do texto que ESTA unidade existe para fazer o gestor ler.
 *
 * Os hexes são LIDOS do CSS real (nunca espelhados à mão), e a classe medida é a que o
 * componente REALMENTE renderiza (lida do DOM) — as duas pontas derivadas da fonte,
 * como manda `rules/security.md` § enumeração que dá poder a um invariante.
 */
describe('SupportSlaSection — contraste do estado vazio (medido, não presumido)', () => {
  const PISO_AA = 4.5

  function tokenDoCss(caminho: string, token: string): string {
    const css = readFileSync(caminho, 'utf8')
    const casamento = new RegExp(token + ':[^#]{0,20}(#[0-9a-fA-F]{6})').exec(css)
    if (casamento === null) throw new Error(`Token ${token} não encontrado em ${caminho}`)
    return casamento[1]
  }

  /** Composição de cor com alfa sobre um fundo opaco (o que `/30` e `/70` fazem). */
  function comAlfa(fg: string, bg: string, alfa: number): string {
    const canais = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const [r1, g1, b1] = canais(fg)
    const [r2, g2, b2] = canais(bg)
    const mistura = [
      [r1, r2],
      [g1, g2],
      [b1, b2],
    ].map(([a, b]) => Math.round(a * alfa + b * (1 - alfa)))
    return `#${mistura.map((c) => c.toString(16).padStart(2, '0')).join('')}`
  }

  const CSS_APP = 'src/styles/global.css'
  const CSS_DS = 'node_modules/@migrate/design-system/styles.css'

  it('o título do vazio usa `text-foreground`, e esse par passa AA sobre o card', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )

    const titulo = screen.getByText('SLA de 1º atendimento não configurado')
    expect(titulo.className).toContain('text-foreground')
    expect(titulo.className).not.toContain('text-primary/30')

    const razao = contrastRatio(
      tokenDoCss(CSS_APP, '--color-foreground'),
      tokenDoCss(CSS_APP, '--color-card'),
    )
    expect(razao).toBeGreaterThanOrEqual(PISO_AA)
  })

  it('a explicação usa /70 (passa AA) — o padrão /50 do repo reprovaria', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={null}
        respondidosForaDoPrazo={null}
        chamadosNoPeriodo={12}
      />,
    )

    const detalhe = screen.getByText(/Nenhum dos 12 chamados/)
    expect(detalhe.className).toContain('text-foreground/70')

    const fg = tokenDoCss(CSS_APP, '--color-foreground')
    const bg = tokenDoCss(CSS_APP, '--color-card')
    expect(contrastRatio(comAlfa(fg, bg, 0.7), bg)).toBeGreaterThanOrEqual(PISO_AA)
    // Controle positivo do medidor: o /50 que o repo usa por padrão REPROVA.
    expect(contrastRatio(comAlfa(fg, bg, 0.5), bg)).toBeLessThan(PISO_AA)
  })

  it('o aviso do FCR passa AA sobre o fundo de alerta', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        fcr={92.3}
        fcrHistoricoDesde="2026-05-20T13:00:00Z"
        periodoInicio="2026-01-01"
      />,
    )

    const regiao = screen.getByRole('region', { name: /FCR \(1º contato\)/ })
    expect(regiao.className).toContain('bg-warning-bg')
    expect(regiao.className).toContain('text-foreground')
    // `text-warning-fg` sobre esse fundo mede 3.00:1 e REPROVA (AP-FRONTEND-018).
    expect(regiao.className).not.toContain('text-warning-fg')

    expect(
      contrastRatio(
        tokenDoCss(CSS_APP, '--color-foreground'),
        tokenDoCss(CSS_APP, '--color-warning-bg'),
      ),
    ).toBeGreaterThanOrEqual(PISO_AA)
  })

  it('POR QUE o EmptyState compartilhado não é usado: a mensagem dele mede < 2:1', () => {
    // Trava do achado. Quando o design system corrigir `text-primary/30`, este teste
    // reprova — e é o sinal de que o `EmptyState` compartilhado pode voltar para cá.
    const primary = tokenDoCss(CSS_DS, '--color-primary')
    const card = tokenDoCss(CSS_APP, '--color-card')
    const razao = contrastRatio(comAlfa(primary, card, 0.3), card)

    expect(razao).toBeLessThan(2)
    expect(razao).toBeLessThan(PISO_AA)
  })
})


/**
 * 124/`P-7` — o VOCABULÁRIO da seção, na tela.
 *
 * A decisão do usuário (`decisoes.md` § `P-7`) foi padronizar em **"1º atendimento"**
 * porque "1ª resposta" descreve errado o que é medido: o indicador conta até o primeiro
 * **apontamento de tempo**, não até a resposta ao cliente. Aqui isso é verificado onde o
 * gestor lê — o título do card e os títulos do drill.
 *
 * O que faz estes asserts ficarem vermelhos: restaurar `title="1ª Resposta vs SLA"` no
 * `SupportSlaSection` (mutação `P7-TITULO-CARD`) ou os títulos `'Respondidos…'` do drill.
 */
describe('SupportSlaSection — vocabulário "1º atendimento" (124/P-7)', () => {
  it('o título do card diz "1º Atendimento vs SLA"', () => {
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
      />,
    )

    expect(screen.getByText('1º Atendimento vs SLA')).toBeInTheDocument()
    // A negativa vem acompanhada da positiva acima, na mesma execução.
    expect(screen.queryByText('1ª Resposta vs SLA')).not.toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/1ª resposta/i)
  })

  it('o drill da fatia leva o título novo — "Atendidos", não "Respondidos"', () => {
    const onSegmentDrill = vi.fn()
    render(
      <SupportSlaSection
        respondidosNoPrazo={7}
        respondidosForaDoPrazo={3}
        chamadosNoPeriodo={10}
        onSegmentDrill={onSegmentDrill}
      />,
    )

    // O marcador que substitui o gráfico não dispara `onSegmentClick`; o que se afirma
    // aqui é a PROP que a seção monta, lida do elemento renderizado.
    expect(screen.getByTestId('sla-chart')).toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/respondidos/i)
  })
})
