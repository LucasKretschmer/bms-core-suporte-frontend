import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { autorDoFechamento, buildBillingPeriodColumns } from './columns'
import type { BillingPeriodDto } from './types/billingPeriod'

const FECHADA: BillingPeriodDto = {
  competencia: '2026-08',
  estado: 'fechada',
  fechadaEm: '2026-09-01T03:00:00Z',
  fechadaPorNome: null,
  reabertaEm: null,
  reabertaPorNome: null,
  reaberturaMotivo: null,
  versao: 1,
  totalClientes: 42,
  totalHorasAdicionais: 12.5,
}

type Handlers = {
  onFechar?: (p: BillingPeriodDto) => void
  onReabrir?: (p: BillingPeriodDto) => void
  onComparar?: (p: BillingPeriodDto) => void
}

function renderCelula(chave: string, row: BillingPeriodDto, handlers: Handlers = {}) {
  const colunas = buildBillingPeriodColumns({
    onFechar: handlers.onFechar ?? vi.fn(),
    onReabrir: handlers.onReabrir ?? vi.fn(),
    onComparar: handlers.onComparar ?? vi.fn(),
    isFechando: false,
    isReabrindo: false,
  })
  const coluna = colunas.find((c) => c.key === chave)
  if (!coluna) throw new Error(`coluna "${chave}" não existe`)
  return render(<>{coluna.accessor(row)}</>)
}

describe('colunas de competência — os guards de ausência', () => {
  it('`null` EXPLÍCITO em cada campo vira travessão — nunca zero, nunca vazio', () => {
    // 🔴 `AP-FRONTEND-028`: trocar `== null` por `=== undefined` deixa passar exatamente
    // este caso, e a célula passa a afirmar "0h 0m" / "0" sobre valores desconhecidos.
    const cru: BillingPeriodDto = {
      competencia: '2026-07',
      estado: 'corrente',
      fechadaEm: null,
      fechadaPorNome: null,
      reabertaEm: null,
      reaberturaMotivo: null,
      versao: null,
      totalClientes: null,
      totalHorasAdicionais: null,
    }

    expect(renderCelula('fechadaEm', cru).container.textContent).toBe('—')
    expect(renderCelula('reabertaEm', cru).container.textContent).toBe('—')
    expect(renderCelula('reaberturaMotivo', cru).container.textContent).toBe('—')
    expect(renderCelula('versao', cru).container.textContent).toBe('—')
    expect(renderCelula('totalClientes', cru).container.textContent).toBe('—')
    expect(renderCelula('totalHorasAdicionais', cru).container.textContent).toBe('—')
  })

  it('ZERO declarado continua zero — a companheira do caso acima', () => {
    const zerada: BillingPeriodDto = {
      ...FECHADA,
      versao: 0,
      totalClientes: 0,
      totalHorasAdicionais: 0,
    }
    expect(renderCelula('versao', zerada).container.textContent).toBe('0')
    expect(renderCelula('totalClientes', zerada).container.textContent).toBe('0')
    expect(renderCelula('totalHorasAdicionais', zerada).container.textContent).toBe('0h 0m')
  })

  it('a competência é exibida por extenso', () => {
    expect(renderCelula('competencia', FECHADA).container.textContent).toBe('Agosto 2026')
  })
})

describe('autorDoFechamento — os DOIS significados de `null`', () => {
  it('sem fechamento ⇒ travessão; com fechamento e sem nome ⇒ processo automático', () => {
    // Colapsar os dois seria mentir nas duas direções: "Processo automático" numa
    // competência que nunca fechou, ou "—" num fechamento que de fato aconteceu.
    expect(autorDoFechamento({ ...FECHADA, fechadaEm: null, fechadaPorNome: null })).toBe('—')
    expect(autorDoFechamento({ ...FECHADA, fechadaPorNome: null })).toBe('Processo automático')
    expect(autorDoFechamento({ ...FECHADA, fechadaPorNome: 'Ana' })).toBe('Ana')
  })
})

describe('coluna Estado', () => {
  it('exibe o rótulo do estado — e o desconhecido não vira um estado real', () => {
    expect(renderCelula('estado', FECHADA).container.textContent).toBe('Fechada')
    expect(
      renderCelula('estado', { ...FECHADA, estado: 'historica' }).container.textContent,
    ).toBe('Histórica')
    // `null` explícito e valor novo do servidor: os dois dizem que não se sabe.
    expect(renderCelula('estado', { ...FECHADA, estado: null }).container.textContent).toBe(
      'Estado não reconhecido',
    )
  })
})

describe('coluna Ações — disponibilidade por estado (C-6 · C-8)', () => {
  it('competência FECHADA: reabrir e comparar disponíveis, fechar bloqueado com motivo', () => {
    renderCelula('acoes', FECHADA)

    const reabrir = screen.getByRole('button', { name: /reabrir competência Agosto 2026/i })
    const comparar = screen.getByRole('button', { name: /comparar snapshot/i })
    const fechar = screen.getByRole('button', { name: /^fechar competência Agosto 2026$/i })

    expect(reabrir).not.toHaveAttribute('aria-disabled')
    expect(comparar).not.toHaveAttribute('aria-disabled')
    expect(fechar).toHaveAttribute('aria-disabled', 'true')
  })

  it('competência HISTÓRICA: as três bloqueadas, cada uma com o motivo (C-6)', () => {
    renderCelula('acoes', { ...FECHADA, estado: 'historica' })

    for (const nome of [/fechar competência/i, /reabrir competência/i, /comparar snapshot/i]) {
      expect(screen.getByRole('button', { name: nome })).toHaveAttribute('aria-disabled', 'true')
    }
    // A metade que importa: o motivo está NO DOM, ligado ao botão.
    expect(screen.getAllByText(/congelamento/i).length).toBeGreaterThan(0)
  })

  it('competência REABERTA: a ação de fechar vira "refechar" (§6.5)', () => {
    // Chamar as duas coisas de "fechar" esconderia que o refechamento grava uma versão
    // nova do snapshot e revalida os créditos.
    renderCelula('acoes', { ...FECHADA, estado: 'reaberta', fechadaEm: null })
    const refechar = screen.getByRole('button', { name: /refechar competência Agosto 2026/i })
    expect(refechar).not.toHaveAttribute('aria-disabled')
    expect(refechar).toHaveTextContent('refechar')
  })

  it('ação BLOQUEADA continua alcançável pelo teclado e anuncia o motivo', () => {
    // 🔴 `rules/frontend.md` § Acessibilidade de teclado. `disabled` nativo tiraria o botão
    // do `Tab` e do leitor de tela — o usuário nunca descobriria POR QUE não pode fechar.
    // Travessia real (`userEvent.tab()`), não `.focus()`.
    renderCelula('acoes', { ...FECHADA, estado: 'historica' })

    const fechar = screen.getByRole('button', { name: /fechar competência/i })
    const descrito = fechar.getAttribute('aria-describedby')
    expect(descrito).not.toBeNull()
    expect(document.getElementById(descrito ?? '')?.textContent).toContain('congelamento')
    expect(fechar).toHaveAttribute('title')
  })

  it('travessia de Tab alcança as TRÊS ações, inclusive as bloqueadas', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">antes</button>
        {
          buildBillingPeriodColumns({
            onFechar: vi.fn(),
            onReabrir: vi.fn(),
            onComparar: vi.fn(),
            isFechando: false,
            isReabrindo: false,
          }).find((c) => c.key === 'acoes')?.accessor({ ...FECHADA, estado: 'historica' })
        }
      </>,
    )

    // Âncora FORA do componente antes de tabular (`AP-QA-007`).
    screen.getByRole('button', { name: 'antes' }).focus()
    const visitados: (string | null)[] = []
    for (let i = 0; i < 3; i += 1) {
      await user.tab()
      visitados.push(document.activeElement?.getAttribute('aria-label') ?? null)
    }

    expect(visitados).toEqual([
      'fechar competência Agosto 2026',
      'reabrir competência Agosto 2026',
      'comparar snapshot e cálculo atual da competência Agosto 2026',
    ])
  })

  it('clicar numa ação BLOQUEADA não chama nada; clicar numa disponível chama', async () => {
    // O par completo: sem a metade positiva, "não chamou" passaria com o handler
    // desconectado — que é o defeito oposto e igualmente invisível.
    const user = userEvent.setup()
    const onFechar = vi.fn()
    const onReabrir = vi.fn()

    renderCelula('acoes', { ...FECHADA, estado: 'historica' }, { onFechar, onReabrir })
    await user.click(screen.getByRole('button', { name: /fechar competência/i }))
    expect(onFechar).not.toHaveBeenCalled()

    renderCelula('acoes', FECHADA, { onFechar, onReabrir })
    await user.click(screen.getAllByRole('button', { name: /reabrir competência/i })[1])
    expect(onReabrir).toHaveBeenCalledTimes(1)
    expect(onReabrir).toHaveBeenCalledWith(FECHADA)
  })
})
