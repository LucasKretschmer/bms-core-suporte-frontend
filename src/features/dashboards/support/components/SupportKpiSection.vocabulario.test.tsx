/**
 * 124/`P-7` — o vocabulário do KPI **na tela**, não só no catálogo.
 *
 * `kpiCatalog.test.ts` prova que a lista de rótulos é a esperada; isso é dado, não tela.
 * O sujeito da decisão do usuário é *"o rótulo que eu leio no painel"*, e por isso o
 * `P-7` precisa de um teste de **componente** (`rules/tests.md` § o sujeito da frase
 * decide o tipo de teste): este arquivo renderiza `SupportKpiSection` com dados e afirma
 * que o texto que sai no DOM diz **"1º atendimento"** — e que **"1ª resposta"** não volta
 * por nenhuma porta.
 *
 * ## Por que "1ª resposta" saiu
 *
 * O indicador conta da abertura do chamado até o **primeiro apontamento de tempo** (o
 * atendente inicia o timer), não até a primeira resposta ao cliente (`prd.md` §F4,
 * `decisoes.md` § `P-7`). O rótulo antigo prometia uma coisa e o número entregava outra.
 *
 * ## O que faz cada assert ficar vermelho
 *
 * - restaurar `label: 'TME / 1ª resposta (corridas)'` ou `'1ª resposta (horas úteis)'` em
 *   `kpiCatalog.ts` (mutação `P7-KPI-ROTULO`);
 * - restaurar `'Respondidos no prazo (SLA)'` / `'Respondidos fora do prazo'`
 *   (mutação `P7-KPI-RESPONDIDOS`).
 *
 * A varredura negativa (`/1ª resposta/i`) roda sobre `document.body.textContent` **com a
 * seção renderizada com dados** — a companheira positiva ao lado impede que ela passe
 * vacuamente com a grade vazia ou em skeleton.
 */

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseMetricsOverview } = vi.hoisted(() => ({ mockUseMetricsOverview: vi.fn() }))

vi.mock('../../shared/hooks/useMetricsOverview', () => ({
  useMetricsOverview: mockUseMetricsOverview,
}))

import { SupportKpiSection } from './SupportKpiSection'

/** Overview com número em todo campo que o catálogo lê — nenhum card fica em branco. */
const OVERVIEW = {
  tempoTotalSegundos: 3600,
  ahtSegundos: 600,
  tempoMedioPausaSegundos: 60,
  mediaPausasPorAtendimento: 1,
  backlog: 4,
  ticketsAbertos: 10,
  ticketsAbertosVariacaoPercent: 5,
  ticketsResolvidos: 8,
  ticketsResolvidosVariacaoPercent: -2,
  taxaResolucao: 80,
  tmrHorasCorridas: 3,
  tmrHorasUteis: 2,
  tmeHorasCorridas: 1.5,
  tmeHorasUteis: 1,
  respondidosNoPrazo: 40,
  respondidosForaDoPrazo: 8,
  ticketsReabertos: 2,
  csat: 4.5,
  fcr: 0.7,
  horasPlantao: 1,
  horasPlano: 2,
  horasFaturadoPorFora: 3,
  horasAnalise: 4,
}

function renderComDados() {
  mockUseMetricsOverview.mockReturnValue({
    data: OVERVIEW,
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
  return render(
    <SupportKpiSection
      scope="management:suporte"
      from="2026-09-01"
      to="2026-09-30"
      clientId={null}
      planId={null}
    />,
  )
}

describe('SupportKpiSection — o vocabulário "1º atendimento" chega ao DOM (124/P-7)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('os dois KPIs de tempo até o 1º atendimento aparecem com o nome novo', () => {
    renderComDados()
    // Literais escritos à mão — nada derivado do KPI_CATALOG (seria tautologia).
    expect(screen.getByText('TME / 1º atendimento (corridas)')).toBeInTheDocument()
    expect(screen.getByText('1º atendimento (horas úteis)')).toBeInTheDocument()
  })

  it('os dois KPIs de SLA dizem "Atendidos", não "Respondidos"', () => {
    renderComDados()
    expect(screen.getByText('Atendidos no prazo (SLA)')).toBeInTheDocument()
    expect(screen.getByText('Atendidos fora do prazo')).toBeInTheDocument()
    expect(screen.queryByText('Respondidos no prazo (SLA)')).not.toBeInTheDocument()
    expect(screen.queryByText('Respondidos fora do prazo')).not.toBeInTheDocument()
  })

  it('o painel inteiro não contém mais "1ª resposta" — com controle positivo na mesma execução', () => {
    renderComDados()
    const texto = document.body.textContent ?? ''
    // Controle positivo: prova que a grade REALMENTE renderizou antes da negativa.
    expect(texto).toContain('1º atendimento')
    expect(texto).toContain('Backlog (em aberto)')
    expect(texto).not.toMatch(/1ª resposta/i)
    expect(texto).not.toMatch(/respondidos/i)
  })

  it('o que mede resposta DE VERDADE não foi renomeado: o CSAT continua CSAT', () => {
    // Companheiro que impede a varredura acima de virar "trocar toda palavra parecida":
    // o CSAT é preenchido pelo cliente, e ali "resposta" seria a palavra certa.
    renderComDados()
    expect(screen.getByText('CSAT')).toBeInTheDocument()
  })
})
