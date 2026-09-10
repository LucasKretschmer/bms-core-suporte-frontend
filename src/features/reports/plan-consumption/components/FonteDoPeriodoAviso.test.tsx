/**
 * 132/F4d — o aviso de origem dos números (D12 · C-6 · C-7 · C-8).
 *
 * O que cada asserção existe para deixar VERMELHA:
 *
 *  1. `fonte` ausente passando a exibir algo → o caso "nada renderizado" cai, e ele tem
 *     **companheira positiva na mesma execução** (um envelope que renderiza), sem a qual
 *     "não renderiza" passaria com o componente quebrado;
 *  2. o selo comunicando só por cor → o caso WCAG 1.4.1 cai (a classe é removida do nó e o
 *     texto tem de continuar dizendo "fechada");
 *  3. o botão de comparação aparecendo para quem não é `GerentePlus`, ou em mês ao vivo → os
 *     dois casos de permissão caem;
 *  4. o link perdendo `competencia` ou `comparar` → a asserção sobre o `navigate` cai (a rota
 *     de destino declara os dois em `validateSearch`; parâmetro a menos abre a tela no estado
 *     padrão e o botão *pareceria* funcionar).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FonteDoPeriodoAviso } from './FonteDoPeriodoAviso'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

const permissoes = { isGerentePlus: true }
vi.mock('../../../../hooks/usePermissions', () => ({
  usePermissions: () => permissoes,
}))

beforeEach(() => {
  navigate.mockClear()
  permissoes.isGerentePlus = true
})

describe('FonteDoPeriodoAviso — o que aparece em cada estado', () => {
  it('🔴 fonte AUSENTE não renderiza nada — e a companheira positiva prova o contrário', () => {
    // As duas metades na MESMA execução: sem a positiva, "não renderiza" seria satisfeito por
    // um componente que nunca monta (`rules/tests.md` § padrão 1).
    const { container: semFonte } = render(<FonteDoPeriodoAviso envelope={{}} />)
    expect(semFonte.querySelector('section')).toBeNull()

    const { container: comFonte } = render(
      <FonteDoPeriodoAviso
        envelope={{ fonte: 'snapshot', competencia: '2026-08', competenciaFechadaEm: null }}
      />,
    )
    expect(comFonte.querySelector('section')).not.toBeNull()
  })

  it('`envelope` undefined (query não resolvida) também não renderiza nada', () => {
    const { container } = render(<FonteDoPeriodoAviso envelope={undefined} />)
    expect(container.querySelector('section')).toBeNull()
  })

  it('fonte desconhecida do servidor ⇒ nada (fail-closed chega até o DOM)', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <FonteDoPeriodoAviso envelope={{ fonte: 'mosaico', competencia: '2026-08' }} />,
    )
    expect(container.querySelector('section')).toBeNull()
    erro.mockRestore()
  })

  it('snapshot ⇒ selo + a data de fechamento formatada', () => {
    render(
      <FonteDoPeriodoAviso
        envelope={{
          fonte: 'snapshot',
          competencia: '2026-08',
          competenciaFechadaEm: '2026-09-01T03:00:00Z',
        }}
      />,
    )
    expect(screen.getByText('Competência fechada')).toBeInTheDocument()
    expect(screen.getByText(/Agosto 2026 fechada em 01\/09\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/não mudam com recálculo/)).toBeInTheDocument()
  })

  it('aovivo ⇒ frase de competência em aberto, sem selo de fechada', () => {
    render(<FonteDoPeriodoAviso envelope={{ fonte: 'aovivo', competencia: '2026-09' }} />)
    expect(screen.getByText(/Setembro 2026 em aberto/)).toBeInTheDocument()
    expect(screen.queryByText('Competência fechada')).toBeNull()
  })

  it('🔴 C-7 + D20: período personalizado sai VERBATIM e leva a frase do crédito zerado', () => {
    render(
      <FonteDoPeriodoAviso
        envelope={{ fonte: 'aovivo', competencia: null, avisoPeriodoNaoMensal: true }}
      />,
    )
    expect(
      screen.getByText(
        'Período personalizado: números calculados ao vivo, podem divergir do que foi faturado.',
      ),
    ).toBeInTheDocument()
    // Sem esta segunda frase, o usuário vê o plano sem crédito e conclui que ele sumiu.
    expect(screen.getByText(/Crédito de horas não é considerado/)).toBeInTheDocument()
  })

  it('C-6: anterior ao congelamento diz que o número foi recalculado', () => {
    render(
      <FonteDoPeriodoAviso
        envelope={{ fonte: 'aovivo', competencia: '2026-05', avisoAnteriorAoCongelamento: true }}
      />,
    )
    expect(screen.getByText(/recalculados pela regra atual/)).toBeInTheDocument()
  })

  it('C-8: `competenciaVersao > 1` mostra a contagem de fechamentos; `1` não mostra nada', () => {
    const { unmount } = render(
      <FonteDoPeriodoAviso
        envelope={{ fonte: 'snapshot', competencia: '2026-08', competenciaVersao: 2 }}
      />,
    )
    expect(screen.getByText('Fechada 2 vezes — a última contagem é a que vale.')).toBeInTheDocument()
    unmount()

    render(
      <FonteDoPeriodoAviso
        envelope={{ fonte: 'snapshot', competencia: '2026-08', competenciaVersao: 1 }}
      />,
    )
    expect(screen.queryByText(/Fechada 1 vezes/)).toBeNull()
  })
})

describe('FonteDoPeriodoAviso — acessibilidade', () => {
  it('a região é uma `<section>` com nome acessível, e NÃO é interativa por si', () => {
    render(<FonteDoPeriodoAviso envelope={{ fonte: 'aovivo', competencia: '2026-09' }} />)
    const regiao = screen.getByRole('region', { name: 'Origem dos números desta tela' })
    expect(regiao.tagName).toBe('SECTION')
    // Em mês ao vivo não há botão nenhum: nada de foco a capturar num aviso informativo.
    expect(regiao.querySelectorAll('button')).toHaveLength(0)
  })

  it('🔴 WCAG 1.4.1: o selo comunica por GLIFO + TEXTO — sem a cor, continua legível', () => {
    render(
      <FonteDoPeriodoAviso envelope={{ fonte: 'snapshot', competencia: '2026-08' }} />,
    )
    const selo = screen.getByText('Competência fechada')

    // A classe de cor/peso é removida do nó: o que sobra tem de dizer "fechada".
    selo.className = ''
    expect(selo.textContent).toContain('Competência fechada')
    // E o glifo é `aria-hidden` — ele decora, não informa.
    expect(selo.querySelector('[aria-hidden="true"]')?.textContent).toBe('🔒')
  })
})

describe('FonteDoPeriodoAviso — o botão de comparação (D12)', () => {
  it('GerentePlus + snapshot ⇒ botão presente, e o link leva os DOIS parâmetros', () => {
    render(
      <FonteDoPeriodoAviso envelope={{ fonte: 'snapshot', competencia: '2026-08' }} />,
    )
    const botao = screen.getByRole('button', { name: 'Comparar com o cálculo atual' })
    expect(botao).toBeInTheDocument()
  })

  it('o clique navega para /competencias com competencia + comparar=1', async () => {
    const user = userEvent.setup()
    render(<FonteDoPeriodoAviso envelope={{ fonte: 'snapshot', competencia: '2026-08' }} />)

    await user.click(screen.getByRole('button', { name: 'Comparar com o cálculo atual' }))

    // Literal escrito à mão: a rota de destino declara `competencia` e `comparar` em
    // `validateSearch` (`routes/_auth/competencias.tsx`). Um parâmetro a menos é DESCARTADO
    // em silêncio e o botão pareceria funcionar (AP-FRONTEND-019).
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith({
      to: '/competencias',
      search: { competencia: '2026-08', comparar: '1' },
    })
  })

  it('🔴 NÃO-GerentePlus não vê o botão (e o aviso continua visível)', () => {
    permissoes.isGerentePlus = false
    render(<FonteDoPeriodoAviso envelope={{ fonte: 'snapshot', competencia: '2026-08' }} />)

    // Companheira positiva: o aviso está na tela — a negativa abaixo não passa pelo vazio.
    expect(screen.getByText('Competência fechada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Comparar com o cálculo atual' })).toBeNull()
  })

  it('mês AO VIVO não tem o que comparar — nem para GerentePlus', () => {
    render(<FonteDoPeriodoAviso envelope={{ fonte: 'aovivo', competencia: '2026-09' }} />)
    expect(screen.getByText(/em aberto/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Comparar com o cálculo atual' })).toBeNull()
  })

  it('snapshot SEM competência não oferece o botão (o link ficaria sem alvo)', () => {
    render(<FonteDoPeriodoAviso envelope={{ fonte: 'snapshot', competencia: null }} />)
    expect(screen.queryByRole('button', { name: 'Comparar com o cálculo atual' })).toBeNull()
  })
})
