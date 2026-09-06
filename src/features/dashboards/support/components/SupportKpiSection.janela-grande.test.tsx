/**
 * 124/FE-P3 — o `422 DATE_RANGE_TOO_LARGE` (`S-1`/`BE-FIX1`) na SEÇÃO DE KPIs.
 *
 * Teste de COMPONENTE: `metricsErrorMessage.test.ts` prova a tradução; este arquivo prova
 * que ela **vira tela** — que o usuário lê o motivo e o limite em vez do texto genérico
 * (`rules/tests.md` § o sujeito da frase decide o tipo de teste).
 *
 * Companheira positiva na MESMA execução: um erro de outro código continua caindo no
 * genérico de sempre. Sem ela, o arquivo provaria apenas que a tela mostra *alguma coisa*.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { derivarCascataDeCssDoApp, lerTokensDeCor } from '../../../../utils/cssCascade'
// Medidor de contraste de `FE-FIX2` — reusado, nunca reescrito. Ele vive em
// `features/support-plans/utils/` e o próprio `fe-fix2-report.md` recomenda movê-lo para
// `src/utils/`; mover é mudança de outra unidade, então aqui só se importa.
import {
  medirTextosDoDom,
  reprovacoesAA,
  temaDaCascata,
} from '../../../support-plans/utils/contrasteDeTexto'

const { mockUseMetricsOverview } = vi.hoisted(() => ({ mockUseMetricsOverview: vi.fn() }))

vi.mock('../../shared/hooks/useMetricsOverview', () => ({
  useMetricsOverview: mockUseMetricsOverview,
}))

import { SupportKpiSection } from './SupportKpiSection'

/**
 * Literal do backend (`DateRangeGuard.RangeTooLargeErrorMessage`,
 * `DateRangeGuard.cs:56-58`). Escrito à mão: nada aqui é derivado da resposta.
 */
const MENSAGEM_DO_BACKEND =
  'O período não pode ser maior que 1 ano (366 dias). ' +
  'Escolha um intervalo menor — por exemplo um mês, ou o ano corrente — e consulte os ' +
  'períodos anteriores em consultas separadas.'

const GENERICO_DOS_KPIS = 'Não foi possível carregar os KPIs.'

function erroApi(status: number, code: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code, message } },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

function comErro(error: unknown) {
  mockUseMetricsOverview.mockReturnValue({
    data: undefined,
    error,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  })
}

function renderSecao() {
  return render(
    <SupportKpiSection
      scope="management:suporte"
      from="2024-01-01"
      to={null}
      clientId={null}
      planId={null}
    />,
  )
}

// ── Contraste: tema derivado da cascata real de CSS do app ────────────────────
const lerCssDoDisco = (caminho: string): string =>
  readFileSync(resolve(process.cwd(), caminho), 'utf8')
const CASCATA_CSS = derivarCascataDeCssDoApp(lerCssDoDisco)
const TOKENS = lerTokensDeCor(CASCATA_CSS, lerCssDoDisco)
const TEMA = temaDaCascata(CASCATA_CSS, lerCssDoDisco, TOKENS)

const medirTela = (container: HTMLElement) =>
  medirTextosDoDom(container, { tema: TEMA, fundoPadrao: TOKENS['--color-background'] })

describe('SupportKpiSection — 422 DATE_RANGE_TOO_LARGE (FE-P3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra o motivo E o limite do servidor — não o texto genérico', () => {
    // O que faz este assert ficar vermelho: remover `mensagemDeJanelaGrandeDemais(error)`
    // da seção (é a mutação P3-KPI-SEM-TRATAMENTO). Sem ela volta o genérico, e o
    // usuário não fica sabendo nem que o problema é o tamanho do período nem qual é o
    // máximo aceito.
    comErro(erroApi(422, 'DATE_RANGE_TOO_LARGE', MENSAGEM_DO_BACKEND))
    renderSecao()

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('O período não pode ser maior que 1 ano (366 dias).')
    expect(alerta).toHaveTextContent('Escolha um intervalo menor')
    expect(alerta).toHaveTextContent('Ajuste o filtro de período.')
    expect(alerta).not.toHaveTextContent(GENERICO_DOS_KPIS)
  })

  it('COMPANHEIRA POSITIVA: outro código continua no tratamento genérico', () => {
    // Se esta ficar vermelha junto com a de cima, o tratamento parou de discriminar —
    // e "a tela mostra alguma coisa" não é o que a unidade entrega.
    comErro(erroApi(500, 'INTERNAL', 'Ocorreu um erro interno. Tente novamente mais tarde.'))
    renderSecao()

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent(GENERICO_DOS_KPIS)
    expect(alerta).not.toHaveTextContent('Ajuste o filtro de período.')
    expect(alerta).not.toHaveTextContent('366')
  })

  it('erro SEM envelope (rede) também continua no genérico', () => {
    comErro(new Error('Network Error'))
    renderSecao()

    expect(screen.getByRole('alert')).toHaveTextContent(GENERICO_DOS_KPIS)
  })

  it('a mensagem específica passa no piso AA — medida no DOM renderizado', () => {
    comErro(erroApi(422, 'DATE_RANGE_TOO_LARGE', MENSAGEM_DO_BACKEND))
    const { container } = renderSecao()

    const medidas = medirTela(container)
    // Controle positivo do medidor #1: ele mediu ALGUMA coisa. Um medidor que não
    // encontra texto colorido aprova qualquer tela por vacuidade.
    expect(medidas.length).toBeGreaterThan(0)
    // E mediu justamente a frase desta unidade.
    expect(medidas.some((m) => m.texto.includes('O período não pode ser maior'))).toBe(true)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('CONTROLE POSITIVO do medidor: ele reprova um par sabidamente ruim', () => {
    // Sem isto, o `toEqual([])` acima seria satisfeito por um medidor morto. `/30` é o
    // mesmo valor que reprova no `EmptyState` do design system (1,84:1, achado do FE-F4).
    const raiz = document.createElement('div')
    raiz.innerHTML =
      '<div class="bg-card"><p class="text-sm text-primary/30">quase invisível</p></div>'

    expect(reprovacoesAA(medirTela(raiz))).toHaveLength(1)
  })
})
