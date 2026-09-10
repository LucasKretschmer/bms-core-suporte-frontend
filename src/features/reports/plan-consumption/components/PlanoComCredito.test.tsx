/**
 * 132/F4b — a célula `15h + 2h` da coluna "Qtde. Plano (h)".
 *
 * O que cada asserção existe para deixar VERMELHA (`rules/tests.md` § Prova de detecção):
 *
 *  1. **regressão zero** — um `?? 0` em `creditoHoras`, ou um `!!creditoHoras` no lugar de
 *     `> 0`, faz a linha SEM crédito ganhar `+ 0h`/ⓘ; as linhas A e B caem. E se o componente
 *     parar de montar, a linha C (com crédito) cai — as duas metades na MESMA renderização;
 *  2. **o discriminador** — colapsar "ausente" e "0" passa em todo teste visual, porque os dois
 *     renderizam o mesmo DOM de propósito. Só `data-credito-conhecido` os separa;
 *  3. **D15** — renderizar `credito.rotulo` do wire em vez da constante local faz a metade
 *     NEGATIVA do wire envenenado cair (a positiva, sozinha, passaria);
 *  4. **a armadilha do default `0m` do C#** — usar `qtdePlanoEfetivoHoras` como fonte do número
 *     imprime `0h`, e o caso do wire com `qtdePlanoEfetivoHoras: 0` cai;
 *  5. **D21** — voltar a `formatHours` imprime `15h 0m + 2h 0m`, e os literais do usuário caem;
 *  6. **WCAG 1.4.1** — tirar o `+` ou o `sr-only` e deixar só a cor faz o caso não-cromático
 *     cair; **o teste remove a classe de cor do nó e exige que a informação continue**.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PlanoComCredito } from './PlanoComCredito'
import type { PlanConsumptionItemDto } from '../../shared/types/reports'

/** Linha-base do wire. Cada caso sobrescreve só o que o caso é sobre. */
function linha(over: Partial<PlanConsumptionItemDto> = {}): PlanConsumptionItemDto {
  return {
    clientId: 1,
    cnpj: '12345678000195',
    nomeFantasia: 'Cliente Exemplo',
    razaoSocial: 'Cliente Exemplo',
    nomePlano: 'Support Elite',
    qtdePlanoHoras: 15,
    horasUsadas: 2.75,
    horasRestantes: 14.25,
    horasAdicionais: 0,
    percentualPlano: 16.18,
    horasFaturaveis: 0,
    horasAnalise: 0,
    ...over,
  }
}

describe('PlanoComCredito — regressão zero e companheira positiva na MESMA renderização', () => {
  it('🔴 3 linhas juntas: A sem a chave, B com 0, C com 2 — só C mostra o crédito', () => {
    // Cardinalidade ASSIMÉTRICA de propósito (0 / 0 / 1): com uma linha de cada lado, o
    // predicado invertido passaria (`rules/tests.md` § cardinalidade simétrica).
    render(
      <>
        <span data-testid="linha-a">
          <PlanoComCredito item={linha()} />
        </span>
        <span data-testid="linha-b">
          <PlanoComCredito item={linha({ creditoHoras: 0 })} />
        </span>
        <span data-testid="linha-c">
          <PlanoComCredito item={linha({ creditoHoras: 2 })} />
        </span>
      </>,
    )

    const a = screen.getByTestId('linha-a')
    const b = screen.getByTestId('linha-b')
    const c = screen.getByTestId('linha-c')

    // ── COMPANHEIRA POSITIVA: a linha com crédito mostra as três coisas ──
    // Sem isto, "A e B não mostram crédito" passaria com o componente quebrado.
    expect(c.querySelector('[data-testid="plano-credito"]')).not.toBeNull()
    expect(c).toHaveTextContent('+ 2h')
    expect(c.textContent).toContain('mais 2h de Crédito de Suporte')
    expect(c.querySelectorAll('button')).toHaveLength(1)

    // ── REGRESSÃO ZERO: os dois ramos sem crédito ficam exatamente como hoje ──
    for (const semCredito of [a, b]) {
      expect(semCredito.querySelector('[data-testid="plano-credito"]')).toBeNull()
      expect(semCredito.querySelectorAll('button')).toHaveLength(0)
      expect(semCredito.textContent).toBe('15h')
      expect(semCredito.textContent).not.toContain('+')
      expect(semCredito.textContent).not.toContain('Crédito')
    }
  })

  it('🔴 `data-credito-conhecido` é o ÚNICO discriminador entre "não sei" e "não há"', () => {
    render(
      <>
        <span data-testid="ausente">
          <PlanoComCredito item={linha()} />
        </span>
        <span data-testid="zero">
          <PlanoComCredito item={linha({ creditoHoras: 0 })} />
        </span>
      </>,
    )

    const ausente = screen.getByTestId('ausente').firstElementChild
    const zero = screen.getByTestId('zero').firstElementChild

    // Os dois textos são IGUAIS — é o requisito, não um efeito colateral.
    expect(ausente?.textContent).toBe(zero?.textContent)
    // E o atributo os separa. Um `?? 0` no núcleo tornaria os dois "true".
    expect(ausente?.getAttribute('data-credito-conhecido')).toBe('false')
    expect(zero?.getAttribute('data-credito-conhecido')).toBe('true')
  })

  it('`null` explícito no wire é tratado como ausência (o caso que `=== undefined` perde)', () => {
    render(<PlanoComCredito item={linha({ creditoHoras: null })} />)
    expect(screen.queryByTestId('plano-credito')).toBeNull()
  })
})

describe('PlanoComCredito — os números que o usuário escreveu (prd.md §5.1)', () => {
  it('🔴 D21: `15h + 2h`, sem os minutos zerados', () => {
    render(<PlanoComCredito item={linha({ creditoHoras: 2 })} />)

    // Literais escritos à mão, do layout do usuário. `formatHours` devolveria
    // "15h 0m + 2h 0m" — é essa diferença que a D21 ratificou.
    expect(screen.getByTestId('plano-credito')).toHaveTextContent('+ 2h')
    const celula = screen.getByTestId('plano-credito').parentElement
    expect(celula?.textContent).toContain('15h')
    expect(celula?.textContent).not.toContain('15h 0m')
    expect(celula?.textContent).not.toContain('2h 0m')
  })

  it('crédito com minutos MANTÉM os minutos (o compacto não arredonda nada)', () => {
    render(<PlanoComCredito item={linha({ qtdePlanoHoras: 15, creditoHoras: 2.5 })} />)
    expect(screen.getByTestId('plano-credito')).toHaveTextContent('+ 2h 30m')
  })

  it('🔴 o default `0m` do C#: `qtdePlanoEfetivoHoras: 0` NÃO vira "0h" na célula', () => {
    // `ReportsDtos.cs:283` — o construtor posicional tem `= 0m`. Ler o campo cru aqui
    // imprimiria zero como plano efetivo numa tela de fatura.
    render(
      <PlanoComCredito
        item={linha({ creditoHoras: 2, qtdePlanoEfetivoHoras: 0 })}
      />,
    )
    const celula = screen.getByTestId('plano-credito').parentElement
    expect(celula?.textContent).toContain('15h')
    expect(celula?.textContent).toContain('+ 2h')
    expect(celula?.textContent).not.toBe('0h')
  })
})

describe('PlanoComCredito — D15: a categoria interna NUNCA chega à tela', () => {
  it('🔴 wire ENVENENADO: o rótulo do wire é ignorado e o público é exibido', () => {
    const { container } = render(
      <PlanoComCredito
        item={linha({
          creditoHoras: 2,
          creditos: [
            {
              creditoId: 1,
              horas: 2,
              // O motivo interno do crédito automático (132/D9). Se o backend regredir e
              // projetar isto, a tela do cliente NÃO pode exibi-lo (AP-SECURITY-001).
              rotulo: 'Estorno de Credito Problema - Invoicy',
            },
          ],
        })}
      />,
    )

    // ⚠️ A metade POSITIVA é obrigatória: só a negativa passaria se o componente não
    // montasse (`rules/tests.md` § asserção negativa satisfeita pelo vazio).
    expect(container.textContent).toContain('Crédito de Suporte')
    expect(container.textContent).not.toContain('Problema - Invoicy')
    expect(container.textContent).not.toContain('Estorno')
  })

  it('o tooltip do ⓘ também não vaza — é o `aria-label` do botão, lido em voz alta', () => {
    render(
      <PlanoComCredito
        item={linha({
          creditoHoras: 2,
          creditos: [{ creditoId: 1, horas: 2, rotulo: 'Problema - Invoicy' }],
        })}
      />,
    )
    const botao = screen.getByRole('button')
    expect(botao.getAttribute('aria-label')).toContain('Crédito de Suporte')
    expect(botao.getAttribute('aria-label')).not.toContain('Invoicy')
  })
})

describe('PlanoComCredito — acessibilidade', () => {
  it('🔴 WCAG 1.4.1: sem a cor, a informação continua inteira', () => {
    render(<PlanoComCredito item={linha({ creditoHoras: 2 })} />)
    const verde = screen.getByTestId('plano-credito')

    // A cor está lá (é reforço) …
    expect(verde.className).toContain('text-success-fg')

    // … e agora ela é REMOVIDA do nó: o que sobra tem de comunicar sozinho.
    verde.className = ''
    expect(verde.textContent).toContain('+')
    // O `sr-only` nomeia o crédito por extenso, e o ⓘ continua alcançável.
    expect(screen.getByText('mais 2h de Crédito de Suporte')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('o valor visível é `aria-hidden` e o acessível é `sr-only` — sem leitura duplicada', () => {
    render(<PlanoComCredito item={linha({ creditoHoras: 2 })} />)

    // Se o `aria-hidden` sair, o leitor de tela lê "15h + 2h mais 2h de Crédito de Suporte".
    expect(screen.getByTestId('plano-credito').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('mais 2h de Crédito de Suporte').className).toContain('sr-only')
  })

  it('🔴 o ⓘ é alcançável por TECLADO (travessia real de Tab, nunca `.focus()`)', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">antes</button>
        <PlanoComCredito item={linha({ creditoHoras: 2 })} />
      </>,
    )

    // A travessia parte de um elemento FORA da célula: `el.focus()` provaria só que o
    // elemento é focável, não que o `Tab` chega nele (`rules/frontend.md`).
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'antes' }))

    await user.tab()
    const infoIcon = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-label')?.includes('Crédito de Suporte'))
    expect(document.activeElement).toBe(infoIcon)
  })

  it('o foco no ⓘ ABRE o tooltip (hover não é o único caminho)', async () => {
    const user = userEvent.setup()
    render(<PlanoComCredito item={linha({ creditoHoras: 2 })} />)

    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.tab()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByRole('tooltip').textContent).toContain('Crédito de Suporte')
  })
})
