/**
 * 132/F9 — o **Crédito de Suporte** no cabeçalho do Relatório do Cliente.
 *
 * O coração destes testes é a **regressão zero** de PRD §5.1, e ela tem uma forma exata
 * (análise §2.4): as duas linhas sem crédito e a linha com crédito coexistem na **mesma
 * renderização**, com cardinalidades diferentes (0 / 0 / 1). Só a negativa
 * ("não aparece crédito") seria satisfeita pelo vazio — um cabeçalho que não montasse
 * passaria em tudo (`rules/tests.md` § padrão 1).
 *
 * O contraste do realce verde é **medido no CSS real** do app (`src/test/medidor-de-contraste`),
 * nunca conferido de cabeça: AA é piso inviolável e já reprovou quatro vezes neste repo.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClientReportHeader } from './ClientReportHeader'
import {
  PISO_AA,
  TOKENS,
  classesDoTexto,
  fundoDoTexto,
  razaoDoTexto,
  reprovacoesAA,
  varrer,
} from '../../../../test/medidor-de-contraste'
import type { ClientReportDto } from '../../shared/types/reports'
import { KPI_PLANO_DE_SUPORTE_LABEL } from '../../shared/utils/competenciaTexts'
import {
  ROTULO_CREDITO_PUBLICO,
  TOOLTIP_CREDITO_PLANO,
} from '../../shared/utils/creditoTexts'

/**
 * Todos os números são diferentes entre si e o crédito de 2 h ("2h 0m") não colide com
 * nenhum outro cartão: assim, ver "2h 0m" na tela só pode ser o crédito.
 *  · `totalSegundos: 13500`          → "3h 45m"
 *  · `horasPlanoSegundos: 9900`      → "2h 45m"  (horas USADAS, não o tamanho do plano)
 *  · `horasFaturadoSegundos: 3600`   → "1h 0m"
 *  · `horasNaoFaturadoSegundos: 0`   → "0h 0m"
 */
function relatorio(overrides: Partial<ClientReportDto> = {}): ClientReportDto {
  return {
    client: {
      id: 7,
      hubspotCompanyId: 10,
      cnpj: null,
      razaoSocial: 'ACME LTDA',
      nomeFantasia: 'ACME',
      supportPlan: null,
      horasOverride: null,
      horasEfetivas: 15,
    },
    plano: {
      id: 2,
      nome: 'Plano 15h',
      horasMes: 15,
      precoHoraExtra: null,
      moeda: 'BRL',
      isActive: true,
    },
    competencia: '2026-08',
    totalApontamentos: 3,
    totalSegundos: 13500,
    horasPlanoSegundos: 9900,
    horasFaturadoSegundos: 3600,
    horasNaoFaturadoSegundos: 0,
    items: null,
    ...overrides,
  }
}

/**
 * ⚠️ Espião restaurado AQUI, nunca na última linha do caso: `mockRestore()` no fim do teste
 * não roda se uma asserção anterior falhar, e `vi.spyOn` sobre método já espionado devolve o
 * MESMO mock — o contador vaza para o caso seguinte e ele falha por motivo alheio (medido na
 * mutação M-F9-1).
 */
afterEach(() => {
  vi.restoreAllMocks()
})

/** O texto do `<span>` de valor do cartão cujo rótulo é `rotulo`. */
function valorDoCartao(raiz: HTMLElement, rotulo: string): string {
  const label = within(raiz).getByText(rotulo)
  return label.nextElementSibling?.textContent ?? ''
}

/** Os rótulos dos cartões de KPI, na ordem do DOM — identidade, não cardinalidade. */
function rotulosDosCartoes(raiz: HTMLElement): string[] {
  const fileira = raiz.querySelector<HTMLElement>('[data-credito-conhecido]')
  if (!fileira) throw new Error('fileira de KPIs não encontrada')
  return Array.from(fileira.children).map(
    (cartao) => cartao.firstElementChild?.textContent ?? '',
  )
}

/**
 * As TRÊS variantes na mesma renderização. `sem-chave` é o backend anterior à 132 (nem
 * `creditoHoras` nem `horasPlanoEfetivas`); `zero` é o backend novo dizendo "não há";
 * `com-credito` é a companheira positiva.
 */
function renderizarAsTres() {
  return render(
    <>
      <div data-testid="sem-chave">
        <ClientReportHeader report={relatorio()} />
      </div>
      <div data-testid="zero">
        <ClientReportHeader
          report={relatorio({ creditoHoras: 0, horasPlanoEfetivas: 15 })}
        />
      </div>
      <div data-testid="com-credito">
        <ClientReportHeader
          report={relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 })}
        />
      </div>
    </>,
  )
}

describe('ClientReportHeader — regressão zero do crédito (132/F9 · §2.4)', () => {
  it('ausente e 0 não produzem NADA de crédito; 2 produz o cartão — na mesma renderização', () => {
    renderizarAsTres()

    const semChave = screen.getByTestId('sem-chave')
    const zero = screen.getByTestId('zero')
    const comCredito = screen.getByTestId('com-credito')

    // Os dois ramos sem crédito: nenhum cartão, e nenhum `<button>` (o ⓘ do tooltip é o
    // único botão que este cabeçalho pode ter).
    expect(within(semChave).queryByText(ROTULO_CREDITO_PUBLICO)).toBeNull()
    expect(within(semChave).queryAllByRole('button')).toHaveLength(0)
    expect(within(zero).queryByText(ROTULO_CREDITO_PUBLICO)).toBeNull()
    expect(within(zero).queryAllByRole('button')).toHaveLength(0)

    // A companheira positiva, na MESMA execução: se o cabeçalho parasse de montar, ou se o
    // cartão nunca aparecesse, é este bloco que fica vermelho — e sem ele as negativas
    // acima passariam pelo vazio.
    expect(within(comCredito).getByText(ROTULO_CREDITO_PUBLICO)).toBeInTheDocument()
    expect(within(comCredito).queryAllByRole('button')).toHaveLength(1)
    expect(valorDoCartao(comCredito, ROTULO_CREDITO_PUBLICO)).toBe('2h 0m')
  })

  it('identidade dos rótulos: 5 cartões sem crédito, os MESMOS 5 + o crédito por último', () => {
    renderizarAsTres()

    const cincoDeSempre = [
      'Apontamentos',
      'Tempo total',
      KPI_PLANO_DE_SUPORTE_LABEL,
      'Faturado',
      'Não faturado',
    ]

    // Identidade literal e ordem — cardinalidade passaria com um cartão entrando e outro
    // saindo.
    expect(rotulosDosCartoes(screen.getByTestId('sem-chave'))).toEqual(cincoDeSempre)
    expect(rotulosDosCartoes(screen.getByTestId('zero'))).toEqual(cincoDeSempre)
    expect(rotulosDosCartoes(screen.getByTestId('com-credito'))).toEqual([
      ...cincoDeSempre,
      ROTULO_CREDITO_PUBLICO,
    ])
  })

  it('os valores dos 5 cartões de sempre são IDÊNTICOS com e sem crédito', () => {
    renderizarAsTres()

    const semChave = screen.getByTestId('sem-chave')
    const comCredito = screen.getByTestId('com-credito')

    // Literais escritos à mão (não derivados da própria resposta): o crédito não pode
    // "corrigir" nenhum dos números que já estavam na tela — nem o de horas usadas.
    const esperados: readonly (readonly [string, string])[] = [
      ['Apontamentos', '3'],
      ['Tempo total', '3h 45m'],
      [KPI_PLANO_DE_SUPORTE_LABEL, '2h 45m'],
      ['Faturado', '1h 0m'],
      ['Não faturado', '0h 0m'],
    ]

    for (const [rotulo, valor] of esperados) {
      expect(valorDoCartao(semChave, rotulo)).toBe(valor)
      expect(valorDoCartao(comCredito, rotulo)).toBe(valor)
    }
  })

  it('o markup dos 5 cartões de sempre é IDÊNTICO — nem uma classe nova', () => {
    renderizarAsTres()

    // Regressão zero no nível da classe, não só do texto: as classes de layout do ⓘ entram
    // **só** no cartão que tem tooltip. Voltar a aplicá-las sem condição (o caminho
    // "natural") mexeria no markup dos 5 cartões que já existiam, nos três ramos.
    const CLASSE_DO_ROTULO = 'text-xs text-foreground/70 font-normal'

    for (const id of ['sem-chave', 'zero', 'com-credito']) {
      const raiz = screen.getByTestId(id)
      for (const rotulo of [
        'Apontamentos',
        'Tempo total',
        KPI_PLANO_DE_SUPORTE_LABEL,
        'Faturado',
        'Não faturado',
      ]) {
        expect(within(raiz).getByText(rotulo).className).toBe(CLASSE_DO_ROTULO)
      }
    }

    // Companheira positiva: o cartão do crédito, esse sim, tem as classes de layout.
    const credito = within(screen.getByTestId('com-credito')).getByText(
      ROTULO_CREDITO_PUBLICO,
    )
    expect(credito.className).toContain('flex items-center gap-1')
  })

  it('`data-credito-conhecido` distingue "não sei" de "não há" — o único discriminador', () => {
    renderizarAsTres()

    const atributo = (id: string) =>
      screen
        .getByTestId(id)
        .querySelector('[data-credito-conhecido]')
        ?.getAttribute('data-credito-conhecido')

    expect(atributo('sem-chave')).toBe('false')
    expect(atributo('zero')).toBe('true')
    expect(atributo('com-credito')).toBe('true')
  })
})

describe('ClientReportHeader — a unidade e a fonte do número do crédito', () => {
  it('2 horas viram "2h 0m", nunca "0h 0m" (o que `formatSeconds` daria)', () => {
    const { container } = render(
      <ClientReportHeader report={relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 })} />,
    )

    expect(valorDoCartao(container, ROTULO_CREDITO_PUBLICO)).toBe('2h 0m')
  })

  it('`horasPlanoEfetivas: 0` (o default do C#) NÃO vira o número exibido', () => {
    // A armadilha do construtor posicional: contra um backend que ainda não preenche o
    // campo, lê-lo cru imprimiria zero num cartão de fatura.
    const { container } = render(
      <ClientReportHeader report={relatorio({ creditoHoras: 2, horasPlanoEfetivas: 0 })} />,
    )

    expect(valorDoCartao(container, ROTULO_CREDITO_PUBLICO)).toBe('2h 0m')
  })

  it('crédito fracionário de 2,75 h ⇒ "2h 45m"', () => {
    const { container } = render(
      <ClientReportHeader
        report={relatorio({ creditoHoras: 2.75, horasPlanoEfetivas: 17.75 })}
      />,
    )

    expect(valorDoCartao(container, ROTULO_CREDITO_PUBLICO)).toBe('2h 45m')
  })

  it('renderizar com wire coerente NÃO acusa divergência de plano efetivo', () => {
    // O plano BASE deste relatório é `client.horasEfetivas` (15 h), nunca
    // `horasPlanoSegundos` (9900 s = horas USADAS). Se a base vier do campo errado, a
    // conferência de `derivarPlanoEfetivo` passa a acusar divergência em TODO cliente — e
    // esse é o sintoma comportamental do defeito, porque o número exibido não muda.
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ClientReportHeader report={relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 })} />,
    )

    expect(erro).not.toHaveBeenCalled()

    // Companheira positiva na MESMA execução: com o wire incoerente ela fala. Sem ela,
    // "não acusou" passaria com uma conferência morta.
    erro.mockClear()
    render(
      <ClientReportHeader report={relatorio({ creditoHoras: 2, horasPlanoEfetivas: 99 })} />,
    )
    expect(erro).toHaveBeenCalledTimes(1)
  })
})

describe('ClientReportHeader — o texto do crédito é LOCAL (D15)', () => {
  it('o tooltip é a constante do repositório, e nenhum motivo interno chega à tela', () => {
    const { container } = render(
      <ClientReportHeader report={relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 })} />,
    )

    // O nome acessível do ⓘ é o `aria-label` = o tooltip. O conteúdo da frase é travado em
    // `creditoTexts.test.ts`; aqui se prova que a tela usa a constante, não uma cópia.
    expect(screen.getByRole('button', { name: TOOLTIP_CREDITO_PLANO })).toBeInTheDocument()
    // A metade negativa, com a positiva na mesma execução: o rótulo público está, e a
    // categoria interna do HubSpot não (AP-SECURITY-001).
    expect(container.textContent).toContain(ROTULO_CREDITO_PUBLICO)
    expect(container.textContent).not.toContain('Invoicy')
  })
})

describe('ClientReportHeader — acessibilidade do cartão de crédito', () => {
  it('travessia real de Tab a partir de fora alcança o ⓘ do crédito', async () => {
    render(
      <>
        <button type="button">antes</button>
        <ClientReportHeader report={relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 })} />
      </>,
    )

    // Âncora fora do cabeçalho: `el.focus()` não prova travessia de teclado.
    screen.getByRole('button', { name: 'antes' }).focus()
    await userEvent.tab()

    expect(screen.getByRole('button', { name: TOOLTIP_CREDITO_PLANO })).toHaveFocus()
  })

  it('sem crédito, o cabeçalho não ganha nenhum ponto de parada de teclado novo', async () => {
    render(
      <>
        <button type="button">antes</button>
        <ClientReportHeader report={relatorio()} />
        <button type="button">depois</button>
      </>,
    )

    screen.getByRole('button', { name: 'antes' }).focus()
    await userEvent.tab()

    // Identidade do destino (o próximo botão da página), nunca "não é o body".
    expect(screen.getByRole('button', { name: 'depois' })).toHaveFocus()
  })

  it('o realce verde do valor passa AA medido no CSS real, e é só REFORÇO', () => {
    const { container } = render(
      <ClientReportHeader report={relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 })} />,
    )

    const { medidas, pulados } = varrer(container)
    // Medidor que descarta em silêncio devolve "0 reprovações".
    expect(pulados).toEqual([])

    // A classe vem do DOM renderizado, não do JSX que eu pretendia escrever.
    expect(classesDoTexto(medidas, '2h 0m')).toEqual(['text-success-fg'])
    // O cartão de KPI tem fundo `bg-background` (o fundo da página), não `bg-card`.
    expect(fundoDoTexto(medidas, '2h 0m')).toEqual([TOKENS['--color-background']])
    expect(razaoDoTexto(medidas, '2h 0m')).toBeGreaterThanOrEqual(PISO_AA)
    expect(reprovacoesAA(medidas)).toEqual([])

    // WCAG 1.4.1: tirando a cor, a informação continua inteira — quem diz "isto é crédito"
    // é o rótulo textual do cartão, não o verde.
    expect(within(container).getByText(ROTULO_CREDITO_PUBLICO)).toBeInTheDocument()
  })
})
