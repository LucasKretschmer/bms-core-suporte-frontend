/**
 * 127/FE-AJUDA + 132/F1 — o `(?)` da tela de Consumo de Planos.
 *
 * ## Por que este arquivo NÃO foi apagado com o card (`FE/D-1`)
 *
 * A 132/D7 removeu o card de exceções e, com ele, o indicador de quatro estados que o
 * gatilho carregava — eram 10 casos, e eles saíram. O que **fica** é o mecanismo de
 * disclosure: é ele que decide se a explicação de competência aparece, e ele passou
 * intacto pela remoção. Apagar o arquivo inteiro perderia a **única** prova do
 * mecanismo que sobrevive, no mês em que a regra de competência mudou.
 *
 * ## O que cada bloco prova, e o que o deixa VERMELHO
 *
 *  1. **o rótulo** — o nome acessível **contém** o visível (WCAG 2.5.3) e **não afirma
 *     conferência**. Fica vermelho se alguém restaurar `'Ajuda e conferência'`, que
 *     prometeria uma conferência que a tela não faz mais;
 *  2. **o disclosure** — abrir/fechar por mouse, `Enter` e espaço; `aria-expanded`
 *     acompanhando; `aria-controls` apontando para um id que **existe nos dois
 *     estados**; e **nenhum focável escondido** atrás do recolhido (travessia real de
 *     `Tab`, nunca `el.focus()` — `rules/frontend.md`). Fica vermelho se o `hidden` do
 *     contêiner sumir, se o conteúdo passar a ser montado sempre, ou se o `<button>`
 *     virar `<div onClick>`;
 *  3. **a nota de competência está lá dentro, com as duas props** (`fora-do-plano`,
 *     `comparaSaudePlanos`) — decisões de 131 e 123/FE-PER, que a 132 **não** revoga.
 *     É a companheira POSITIVA das asserções negativas do bloco 2: sem ela, "não
 *     renderiza nada quando fechado" passaria com o componente quebrado
 *     (`rules/tests.md` § padrão 1);
 *  4. **contraste medido no DOM**, com `pulados` vazio e controle positivo na mesma
 *     árvore.
 *
 * 🔴 **Nenhum serviço é mockado neste arquivo, e isso é deliberado, não esquecimento.**
 * O componente deixou de fazer requisição: um `vi.mock('…/reportsService')` aqui
 * silenciaria justamente a regressão de alguém devolver uma query ao `(?)` — com o mock
 * no lugar, a query nova responderia e todos os casos abaixo continuariam verdes. Sem
 * mock, ela quebra ruidosamente. **Não é uma asserção** (não há um `expect` que a
 * prove), é uma propriedade do arranjo; quem reintroduzir uma requisição tem de decidir
 * conscientemente mockar, e este parágrafo é o que ele lê antes.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

import { PlanConsumptionHelp } from './PlanConsumptionHelp'
import {
  TEXTO_AJUDA_NOME_ACESSIVEL,
  TEXTO_AJUDA_ROTULO,
} from '../planConsumptionHelpTexts'
import {
  TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS,
  TEXTO_COMPETENCIA_TITULO,
  TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
  TEXTO_QTDE_TICKETS_RECORTE_PROPRIO,
  textoPeriodoDeApontamento,
} from '../../shared/utils/competenciaTexts'
import { reprovacoesAA, varrer } from '../../../../test/medidor-de-contraste'

/**
 * Renderiza sobre uma superfície REAL da tela (`bg-background`, o fundo da página onde o
 * `(?)` vive) — é esse fundo que o medidor de contraste precisa enxergar.
 *
 * O `QueryClientProvider` fica de propósito, mesmo sem query nenhuma: se alguém
 * reintroduzir uma requisição no componente, ela reprova por asserção (bloco 5), não
 * por "no QueryClient set" — erro de infraestrutura que se confunde com defeito de
 * teste.
 */
function renderAjuda(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <div className="bg-background">{children}</div>
    </QueryClientProvider>
  )
  return render(ui, { wrapper })
}

/** O gatilho é o único elemento que existe nos dois estados — é por ele que se pergunta. */
function gatilho(): HTMLElement {
  return screen.getByTestId('ajuda-gatilho')
}

/** A nota, quando aberta. `getByRole` com o nome acessível — não por testid. */
function nota(): HTMLElement {
  return screen.getByRole('region', { name: TEXTO_COMPETENCIA_TITULO })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. O rótulo — o que ele afirma, e o que ele DEIXOU de afirmar (132/D7)
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanConsumptionHelp — o rótulo do gatilho', () => {
  it('o nome acessível CONTÉM o rótulo visível (WCAG 2.5.3, Label in Name)', () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    // Literais escritos à mão AO LADO das constantes: comparar constante com constante
    // seria tautologia (`rules/tests.md` § expectativa derivada da própria resposta).
    expect(TEXTO_AJUDA_ROTULO).toBe('Ajuda')
    expect(TEXTO_AJUDA_NOME_ACESSIVEL).toBe('Ajuda: como o período é contado nesta tela')
    expect(TEXTO_AJUDA_NOME_ACESSIVEL).toContain(TEXTO_AJUDA_ROTULO)

    expect(gatilho()).toHaveAttribute('aria-label', TEXTO_AJUDA_NOME_ACESSIVEL)
    expect(gatilho()).toHaveTextContent(TEXTO_AJUDA_ROTULO)
  })

  it('🔴 nem o rótulo nem o nome acessível prometem CONFERÊNCIA (132/D7)', () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    // Vermelho se alguém restaurar 'Ajuda e conferência' ou o sufixo "…exigem
    // conferência": as exceções de faturamento não existem mais, e o texto prometeria
    // uma conferência que a tela não faz (AP-FRONTEND-022).
    const nomeAcessivel = gatilho().getAttribute('aria-label') ?? ''
    // Companheira positiva PRIMEIRO: sem ela os dois `not.toMatch` abaixo passariam por
    // vacuidade sobre uma string vazia (`rules/tests.md` § padrão 1).
    expect(nomeAcessivel.length).toBeGreaterThan(10)
    expect(gatilho().textContent ?? '').toContain('Ajuda')

    expect(nomeAcessivel).not.toMatch(/confer/i)
    expect(gatilho().textContent ?? '').not.toMatch(/confer/i)
  })

  it('o glifo `?` é visível — o gatilho não depende de cor nem de ícone decorativo', () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    expect(screen.getByTestId('ajuda-glifo')).toHaveTextContent('?')
  })

  it('🔴 não existe mais selo nem região de anúncio no gatilho (saíram com o card)', async () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    // Companheira positiva na MESMA execução: o gatilho existe e funciona. Sem ela, as
    // duas negativas passariam com o componente inteiro quebrado.
    expect(gatilho()).toBeInTheDocument()
    await userEvent.click(gatilho())
    expect(gatilho()).toHaveAttribute('aria-expanded', 'true')

    expect(screen.queryByTestId('ajuda-selo')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ajuda-anuncio')).not.toBeInTheDocument()
    // O `data-estado` era o discriminador dos 4 estados do indicador — não há estado.
    expect(gatilho()).not.toHaveAttribute('data-estado')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. O disclosure — o que o (?) abre, e o que ele esconde
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanConsumptionHelp — recolher e abrir', () => {
  it('FECHADO: a nota não está na tela, e o contêiner do `aria-controls` existe oculto', () => {
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)

    expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(TEXTO_COMPETENCIA_TITULO)).not.toBeInTheDocument()
    // O contêiner existe (o `aria-controls` aponta para algo real) e está oculto.
    expect(screen.getByTestId('ajuda-conteudo')).toHaveAttribute('hidden')
  })

  it('ABERTO: mostra a nota de competência com o período da tela', async () => {
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)

    await userEvent.click(gatilho())

    expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
    // 🔴 O texto do recorte vem da FUNÇÃO de produção, não de uma cópia (AP-QA-045): a
    // 132/F3 vai reescrever essa frase ("concluídos" → "apontados"), e uma cópia literal
    // aqui divergiria em silêncio — ou obrigaria a F3 a "consertar" este teste.
    expect(
      within(nota()).getByText(
        textoPeriodoDeApontamento({ from: '2026-07-01', to: '2026-07-31' }),
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId('ajuda-conteudo')).not.toHaveAttribute('hidden')
  })

  it('o segundo clique recolhe de novo (é um disclosure, não um caminho de ida)', async () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    await userEvent.click(gatilho())
    expect(screen.getByText(TEXTO_COMPETENCIA_TITULO)).toBeInTheDocument()

    await userEvent.click(gatilho())
    expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(TEXTO_COMPETENCIA_TITULO)).not.toBeInTheDocument()
  })

  it('abre pelo TECLADO — Tab até o gatilho e Enter (nada exige mouse)', async () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    // Ancorado FORA do componente: a travessia começa no início do documento.
    await userEvent.tab()
    expect(document.activeElement).toBe(gatilho())

    await userEvent.keyboard('{Enter}')
    expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(TEXTO_COMPETENCIA_TITULO)).toBeInTheDocument()
  })

  it('espaço também alterna (semântica nativa de <button>, não de div clicável)', async () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    expect(gatilho().tagName).toBe('BUTTON')
    expect(gatilho()).toHaveAttribute('type', 'button')
    gatilho().focus()
    await userEvent.keyboard(' ')
    expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
  })

  it('`aria-controls` aponta para um id que EXISTE nos dois estados', async () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    const id = gatilho().getAttribute('aria-controls')
    expect(id).toBeTruthy()
    expect(document.getElementById(id ?? '')).toBe(screen.getByTestId('ajuda-conteudo'))

    await userEvent.click(gatilho())
    expect(document.getElementById(id ?? '')).toBe(screen.getByTestId('ajuda-conteudo'))
  })

  it('nenhum focável fica escondido atrás do recolhido (travessia real de Tab)', async () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    const paradas: (Element | null)[] = []
    for (let i = 0; i < 3; i += 1) {
      await userEvent.tab()
      paradas.push(document.activeElement)
    }
    // Só o gatilho é focável enquanto fechado; as paradas seguintes saem para o body.
    expect(paradas[0]).toBe(gatilho())
    expect(paradas.slice(1).every((p) => p === document.body || p === gatilho())).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. A nota de competência — as props são requisito de OUTRAS demandas (FE/D-1)
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanConsumptionHelp — a nota que a 132 NÃO removeu', () => {
  it('🔴 usa `fora-do-plano` (131) e compara com Saúde dos Planos (123/FE-PER, D-14)', async () => {
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)
    await userEvent.click(gatilho())

    // As duas frases vêm das CONSTANTES de produção (AP-QA-045), não de cópias: a F3 vai
    // reescrevê-las e este teste tem de acompanhar sem virar contrato do texto antigo.
    //
    // `notaDeProjeto="fora-do-plano"` — nesta tela projeto NÃO consome o plano (131).
    // Vermelho se a prop for trocada por `no-plano-por-apontamento` (a do Relatório do
    // Cliente) ou omitida: as duas telas afirmam coisas DIFERENTES desde a 131.
    expect(
      within(nota()).getByText(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS),
    ).toBeInTheDocument()
    // `comparaSaudePlanos` — a frase que existe só nesta tela (123/FE-PER, D-14).
    expect(within(nota()).getByText(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS)).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Contraste medido no DOM — com controle positivo e `pulados` vazio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mede o que a árvore RENDERIZA (nunca a classe que o teste passou), com o medidor
 * consolidado do repo. `pulados` vazio é obrigatório: recusa do medidor reprova aqui em
 * vez de virar fallback silencioso (125/FE-A11Y-4, `Q-3`).
 *
 * ⚠️ `AP-FRONTEND-030` — nada aqui assevera `m.texto === <frase longa>`: o medidor
 * **trunca em 60 caracteres** e a igualdade passaria por vacuidade. A companheira
 * positiva é a CONTAGEM de medidas (que só cresce se o medidor alcançou a árvore) mais o
 * controle positivo do último caso, que é o único assert que reprova quando o medidor
 * morre.
 */
// ─────────────────────────────────────────────────────────────────────────────
// 4. 135/G1 — o recorte PRÓPRIO da contagem de chamados, dentro do disclosure
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanConsumptionHelp — o parágrafo da contagem de chamados (135/G1)', () => {
  it('🔴 T-20: FECHADO não mostra o parágrafo; ABERTO mostra — e ele fica FORA da nota', async () => {
    renderAjuda(<PlanConsumptionHelp from="2026-08-01" to="2026-08-31" />)

    // Fechado: nada. Solto na tela ele voltaria a empurrar a tabela para baixo, que é
    // exatamente a decisão de 127/FE-AJUDA.
    expect(screen.queryByText(TEXTO_QTDE_TICKETS_RECORTE_PROPRIO)).not.toBeInTheDocument()

    await userEvent.click(gatilho())

    // O texto vem do MÓDULO, nunca de uma cópia literal aqui: uma cópia divergiria em
    // silêncio quando o texto for reescrito, ou obrigaria quem o reescrever a "consertar"
    // este teste.
    const paragrafo = screen.getByText(TEXTO_QTDE_TICKETS_RECORTE_PROPRIO)
    expect(paragrafo).toBeInTheDocument()

    // 🔴 FORA de `<CompetenciaNota>`, e essa é a razão de ele existir como parágrafo
    // separado: a nota é COMPARTILHADA com o Relatório do Cliente, que não tem esta
    // coluna — um parágrafo dentro dela afirmaria lá a existência de uma coluna
    // inexistente (AP-FRONTEND-028). A companheira POSITIVA é a nota estar na tela na
    // MESMA renderização: sem ela, "não está dentro da nota" passaria com a nota ausente.
    expect(nota()).toBeInTheDocument()
    expect(nota()).not.toContainElement(paragrafo)

    // E os dois vivem dentro do conteúdo recolhível (o `aria-controls` do gatilho).
    expect(screen.getByTestId('ajuda-conteudo')).toContainElement(paragrafo)
  })

  it('o segundo clique recolhe o parágrafo junto com a nota', async () => {
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    await userEvent.click(gatilho())
    expect(screen.getByText(TEXTO_QTDE_TICKETS_RECORTE_PROPRIO)).toBeInTheDocument()

    await userEvent.click(gatilho())
    expect(screen.queryByText(TEXTO_QTDE_TICKETS_RECORTE_PROPRIO)).not.toBeInTheDocument()
  })
})

describe('PlanConsumptionHelp — contraste AA', () => {
  function medir(container: HTMLElement) {
    const { medidas, pulados } = varrer(container)
    expect(pulados).toEqual([])
    return medidas
  }

  it('FECHADO: nenhum texto abaixo de 4,5:1', () => {
    const { container } = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    const medidas = medir(container)
    expect(medidas.length).toBeGreaterThan(1)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('ABERTO: a árvore inteira (gatilho + nota) continua sem reprovação', async () => {
    const { container } = renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)
    await userEvent.click(gatilho())

    const medidas = medir(container)
    // Piso mais alto que o do caso fechado, de propósito: se o conteúdo parasse de
    // montar, esta cardinalidade reprova em vez de o teste passar medindo só o botão.
    expect(medidas.length).toBeGreaterThan(4)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  /**
   * Controle positivo, na MESMA execução e na MESMA árvore: um medidor que morresse
   * (parasse de alcançar o componente e devolvesse "0 reprovações") deixaria este caso
   * vermelho. Sem ele, os dois casos acima passariam vacuamente.
   */
  it('controle positivo: um texto propositalmente ruim NA ÁRVORE é reprovado', async () => {
    const { container } = renderAjuda(
      <div>
        <PlanConsumptionHelp from={null} to={null} />
        <p className="text-muted/30">controle positivo de contraste</p>
      </div>,
    )
    await userEvent.click(gatilho())

    const reprovacoes = reprovacoesAA(medir(container))
    expect(reprovacoes).toHaveLength(1)
    expect(reprovacoes[0]).toContain('controle positivo de contraste')
    expect(reprovacoes[0]).toContain('text-muted/30')
  })
})
