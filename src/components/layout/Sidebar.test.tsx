import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PADROES,
  PISO_NAO_TEXTUAL,
  TEMA,
  TOKENS,
  fundosDoAlvo,
  razaoDoAlvo,
  razaoDoTexto,
  reprovacoesAA,
  reprovacoesDoAnel,
  varrer,
  varrerAnel,
} from '../../test/medidor-de-contraste'
import { classeDeTextoNaoModelavel, coresDeTextoDaClasse } from '../../utils/contrasteDeTexto'
import { anelDeFocoDoCss, medirAnelDeFoco } from '../../utils/contrasteDoAnelDeFoco'

const { mockUsePermissions, rotaAtiva } = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
  /** Rota que o "router" considera ativa. `''` = nenhuma (todo link fica inativo). */
  rotaAtiva: { valor: '' as string },
}))

/**
 * Link/anchor simplificado — não precisamos de `RouterProvider` no teste.
 *
 * 125/FE-A11Y-4: o mock **encaminha `className`, `inactiveProps` e `activeProps`** e
 * aplica os `activeProps` na rota marcada como ativa, exatamente como o router faz
 * (acrescentando, nunca substituindo). O mock anterior descartava as três coisas, e a
 * varredura de contraste media uma sidebar **sem nenhuma das classes de cor dos itens** —
 * ela media a cor herdada do `<nav>` e "passava". Mock que apaga a classe sob teste
 * transforma a medição em outra pergunta.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    className,
    inactiveProps,
    activeProps,
    title,
    children,
  }: {
    to: string
    className?: string
    inactiveProps?: { className?: string }
    activeProps?: { className?: string }
    title?: string
    children: React.ReactNode
  }) => {
    const doEstado =
      to === rotaAtiva.valor ? activeProps?.className : inactiveProps?.className
    return (
      <a href={to} title={title} className={[className, doEstado].filter(Boolean).join(' ')}>
        {children}
      </a>
    )
  },
}))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))

import { Sidebar } from './Sidebar'

function setRole(opts: { isCoordenadorOuAcima: boolean; isGerentePlus: boolean; isGestor?: boolean }) {
  mockUsePermissions.mockReturnValue({
    role: null,
    isCoordenadorOuAcima: opts.isCoordenadorOuAcima,
    isGerentePlus: opts.isGerentePlus,
    isAtendente: !opts.isCoordenadorOuAcima,
    // 118.6: no modelo binário, isGestor equivale a "não-atendente". Por padrão espelha
    // isCoordenadorOuAcima (mantém os testes de regressão existentes válidos), mas pode
    // ser sobrescrito explicitamente para os cenários ATENDENTE/GERENTE do 118.6.
    isGestor: opts.isGestor ?? opts.isCoordenadorOuAcima,
    primaryTeamId: null,
    isAuthenticated: true,
  })
}

describe('Sidebar — grupo Administração', () => {
  afterEach(() => vi.clearAllMocks())

  it('oculta itens de Administração para ATENDENTE', () => {
    setRole({ isCoordenadorOuAcima: false, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)

    expect(screen.queryByText('Administração')).not.toBeInTheDocument()
    expect(screen.queryByText('Categorias')).not.toBeInTheDocument()
    expect(screen.queryByText('Equipes e Atendentes')).not.toBeInTheDocument()
    expect(screen.queryByText('Configurações')).not.toBeInTheDocument()
  })

  it('mostra itens de Administração para COORDENADOR+', () => {
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)

    expect(screen.getByText('Administração')).toBeInTheDocument()
    expect(screen.getByText('Categorias')).toBeInTheDocument()
    expect(screen.getByText('Planos')).toBeInTheDocument()
    expect(screen.getByText('Equipes e Atendentes')).toBeInTheDocument()
    expect(screen.getByText('Configurações')).toBeInTheDocument()
  })

  it('Sincronizador (GerentePlus) continua oculto para coordenador', () => {
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    expect(screen.queryByText('Sincronizador')).not.toBeInTheDocument()
  })
})

describe('Sidebar — Apontamentos por Projeto (057)', () => {
  afterEach(() => vi.clearAllMocks())

  it('mostra "Apontamentos por Projeto" para ATENDENTE (não exige CoordenadorPlus)', () => {
    setRole({ isCoordenadorOuAcima: false, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    const link = screen.getByText('Apontamentos por Projeto').closest('a')
    expect(link).toHaveAttribute('href', '/relatorios/apontamentos-projeto')
  })

  it('mostra "Apontamentos por Projeto" para COORDENADOR+', () => {
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    expect(screen.getByText('Apontamentos por Projeto')).toBeInTheDocument()
  })
})

describe('Sidebar — Dashboards e Consumo de Planos para ATENDENTE (118.6)', () => {
  afterEach(() => vi.clearAllMocks())

  function setAtendente() {
    setRole({ isCoordenadorOuAcima: false, isGerentePlus: false, isGestor: false })
  }

  it('mostra o grupo "Dashboards" e o item "Suporte" para ATENDENTE', () => {
    setAtendente()
    render(<Sidebar isCollapsed={false} />)
    expect(screen.getByText('Dashboards')).toBeInTheDocument()
    const link = screen.getByText('Suporte').closest('a')
    expect(link).toHaveAttribute('href', '/dashboards/suporte')
  })

  it('oculta "Onboarding" para ATENDENTE (permanece restrito a gestor)', () => {
    setAtendente()
    render(<Sidebar isCollapsed={false} />)
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument()
  })

  it('mostra "Consumo de Planos" para ATENDENTE', () => {
    setAtendente()
    render(<Sidebar isCollapsed={false} />)
    const link = screen.getByText('Consumo de Planos').closest('a')
    expect(link).toHaveAttribute('href', '/relatorios/consumo-planos')
  })

  it('oculta "Relatório do Cliente", "Produtividade", "Movimentação Diária", Administração e Sincronizador para ATENDENTE', () => {
    setAtendente()
    render(<Sidebar isCollapsed={false} />)
    expect(screen.queryByText('Relatório do Cliente')).not.toBeInTheDocument()
    expect(screen.queryByText('Produtividade')).not.toBeInTheDocument()
    expect(screen.queryByText('Movimentação Diária')).not.toBeInTheDocument()
    expect(screen.queryByText('Administração')).not.toBeInTheDocument()
    expect(screen.queryByText('Categorias')).not.toBeInTheDocument()
    expect(screen.queryByText('Planos')).not.toBeInTheDocument()
    expect(screen.queryByText('Equipes e Atendentes')).not.toBeInTheDocument()
    expect(screen.queryByText('Configurações')).not.toBeInTheDocument()
    expect(screen.queryByText('Sincronizador')).not.toBeInTheDocument()
  })

  it('GERENTE vê todos os itens, incluindo Onboarding, Administração e Sincronizador (regressão "vê tudo")', () => {
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: true, isGestor: true })
    render(<Sidebar isCollapsed={false} />)

    expect(screen.getByText('Dashboards')).toBeInTheDocument()
    expect(screen.getByText('Suporte')).toBeInTheDocument()
    expect(screen.getByText('Onboarding')).toBeInTheDocument()
    expect(screen.getByText('Consumo de Planos')).toBeInTheDocument()
    expect(screen.getByText('Apontamentos por Ticket')).toBeInTheDocument()
    expect(screen.getByText('Apontamentos por Projeto')).toBeInTheDocument()
    expect(screen.getByText('Relatório do Cliente')).toBeInTheDocument()
    expect(screen.getByText('Produtividade')).toBeInTheDocument()
    expect(screen.getByText('Movimentação Diária')).toBeInTheDocument()
    expect(screen.getByText('Administração')).toBeInTheDocument()
    expect(screen.getByText('Categorias')).toBeInTheDocument()
    expect(screen.getByText('Planos')).toBeInTheDocument()
    expect(screen.getByText('Equipes e Atendentes')).toBeInTheDocument()
    expect(screen.getByText('Configurações')).toBeInTheDocument()
    expect(screen.getByText('Sincronizador')).toBeInTheDocument()
  })
})

describe('Sidebar — Planos de Suporte (124/F1)', () => {
  afterEach(() => vi.clearAllMocks())

  it('oculta "Planos" para ATENDENTE', () => {
    // `GET /support-plans` exige CoordenadorPlus (`SupportPlansController.cs:29`): o
    // atendente que clicasse tomaria 403 depois de a tela montar.
    setRole({ isCoordenadorOuAcima: false, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    expect(screen.queryByText('Planos')).not.toBeInTheDocument()
  })

  it('mostra "Planos" para COORDENADOR+ apontando para /planos — companheira positiva', () => {
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    const link = screen.getByText('Planos').closest('a')
    expect(link).toHaveAttribute('href', '/planos')
  })

  it('"Planos" não colide com "Consumo de Planos" — são dois itens distintos', () => {
    // O rótulo curto foi escolhido de propósito; este assert fica vermelho se alguém
    // trocar um dos dois por um texto que engula o outro.
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    expect(screen.getByText('Planos').closest('a')).toHaveAttribute('href', '/planos')
    expect(screen.getByText('Consumo de Planos').closest('a')).toHaveAttribute(
      'href',
      '/relatorios/consumo-planos',
    )
  })
})

describe('Sidebar — Calendário Comercial (124/F2+F3)', () => {
  afterEach(() => vi.clearAllMocks())

  it('oculta "Calendário" para ATENDENTE', () => {
    // `GET /calendars` exige CoordenadorPlus (`CalendarsController.cs`): o atendente que
    // clicasse tomaria 403 depois de a tela montar.
    setRole({ isCoordenadorOuAcima: false, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    expect(screen.queryByText('Calendário')).not.toBeInTheDocument()
  })

  it('mostra "Calendário" para COORDENADOR+ apontando para /calendario — companheira positiva', () => {
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    expect(screen.getByText('Calendário').closest('a')).toHaveAttribute('href', '/calendario')
  })

  it('"Calendário" e "Planos" convivem no grupo Administração, cada um com sua rota', () => {
    // O item "Planos" é de FE-F1 e não foi duplicado nem alterado por FE-F2F3.
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: false })
    render(<Sidebar isCollapsed={false} />)
    expect(screen.getAllByText('Planos')).toHaveLength(1)
    expect(screen.getAllByText('Calendário')).toHaveLength(1)
    expect(screen.getByText('Planos').closest('a')).toHaveAttribute('href', '/planos')
    expect(screen.getByText('Calendário').closest('a')).toHaveAttribute('href', '/calendario')
  })
})

describe('Sidebar — contraste dos títulos de grupo (125/FE-A11Y-3)', () => {
  afterEach(() => vi.clearAllMocks())

  /**
   * Metade estrutural da prova: QUAL classe o DOM de fato renderiza. A outra metade — o
   * número, medido contra as duas pontas do gradiente — está no `describe` abaixo, que
   * varre a árvore com o medidor consolidado.
   */
  function classesDosTitulosDeGrupo(): string[] {
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: true })
    render(<Sidebar isCollapsed={false} />)
    return ['Dashboards', 'Relatórios', 'Administração'].map((rotulo) => {
      const botao = screen.getByText(rotulo).closest('button')
      if (botao === null) {
        throw new Error(
          `O título de grupo "${rotulo}" não é mais um <button> — sem ele esta asserção ` +
            'passaria vazia em vez de medir a classe renderizada.',
        )
      }
      return botao.className
    })
  }

  it('os três títulos renderizam `text-white/70` (era `/60`, 4,33:1 na ponta clara)', () => {
    const classes = classesDosTitulosDeGrupo()
    expect(classes).toHaveLength(3)
    for (const className of classes) {
      expect(className).toContain('text-white/70')
      expect(className).not.toContain('text-white/60')
    }
  })

  it('os três compartilham EXATAMENTE a mesma classe — nenhum grupo diverge', () => {
    // Identidade, não "todos contêm": um grupo que ganhe um alfa próprio numa edição
    // futura reprova aqui, mesmo que ainda contenha `text-white/70` em algum lugar.
    expect(new Set(classesDosTitulosDeGrupo()).size).toBe(1)
  })
})

/**
 * 125/FE-A11Y-4 (`Q-3`) — **a sidebar inteira, medida no DOM sobre o GRADIENTE**.
 *
 * Até aqui a barra nunca tinha sido varrida: o medidor não modelava `background-image` e
 * `bg-grad-escuro` o fazia **lançar**, então nenhum teste conseguia medi-la e o único
 * número existente (o dos títulos de grupo) era aritmética escrita à mão em outro arquivo.
 * Agora o medidor deriva as paradas do gradiente do CSS real e devolve **uma medida por
 * ponta**, de modo que o veredito é o do PIOR ponto — a ponta clara `#074b7f`.
 *
 * Os dois estados são varridos de propósito: foi no item **ativo** que a varredura achou
 * o defeito (`text-white/70` + `text-white` no mesmo elemento = 4,33:1 na ponta clara).
 */
describe('Sidebar — contraste da barra inteira sobre o gradiente (125/FE-A11Y-4)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    rotaAtiva.valor = ''
  })

  function varrerSidebar(ativa: string) {
    rotaAtiva.valor = ativa
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: true })
    render(<Sidebar isCollapsed={false} />)
    // Raiz no `document.body`: é a regra da demanda 125 e o que garante que nada da árvore
    // fique de fora da medição.
    return varrer(document.body)
  }

  it('mede as DUAS pontas do gradiente — e não pula nada', () => {
    const { medidas, pulados } = varrerSidebar('')

    // `pulados` vazio é o que transforma "não sei medir" em reprovação. Se o medidor
    // voltar a não modelar `background-image`, ou o texto some daqui ou ele passa a ser
    // medido contra o fundo da página — as duas coisas quebram este bloco.
    expect(pulados).toEqual([])
    expect(medidas.length).toBeGreaterThan(20)
    expect(Array.from(new Set(medidas.map((m) => m.fundo))).sort()).toEqual([
      '#002f4f',
      '#074b7f',
    ])
  })

  it('as classes de cor MEDIDAS são as da barra — identidade, não "contém"', () => {
    // Sem esta trava, um mock de `Link` que descarte `className`/`inactiveProps` (foi o que
    // o mock original fazia) deixaria a varredura medindo só a cor herdada do `<nav>` —
    // `reprovacoesAA` ficaria vazio por medir OUTRA COISA, e "0 reprovações" seria
    // indistinguível de "a barra não foi medida". Identidade, e não `toContain`: uma cor
    // nova entra aqui antes de entrar na tela.
    const { medidas } = varrerSidebar('')
    expect(Array.from(new Set(medidas.map((m) => m.classe))).sort()).toEqual([
      'text-white',
      'text-white/70',
      'text-white/80',
    ])
  })

  it('estado INATIVO: nenhum texto abaixo de 4,5:1 na ponta clara', () => {
    const { medidas } = varrerSidebar('')

    expect(reprovacoesAA(medidas)).toEqual([])
    // Os números, não só "não reprovou" — e sempre o pior ponto.
    expect(razaoDoTexto(medidas, 'Dashboards').toFixed(2)).toBe('5.31') // título de grupo
    expect(razaoDoTexto(medidas, 'Dashboard').toFixed(2)).toBe('5.31') // NavLink `/80`
    expect(razaoDoTexto(medidas, 'Consumo de Planos').toFixed(2)).toBe('5.31') // SubNavLink
  })

  it('estado ATIVO: o item selecionado passa (era 4,33:1 com as duas classes de cor)', () => {
    // O `activeProps` do router ACRESCENTA classes. Com a cor no `className` base, o item
    // ativo carregava `text-white/70` E `text-white`; na folha gerada pelo Tailwind
    // `.text-white` vem antes de `.text-white\/70`, então o `/70` vencia — 4,33:1 na ponta
    // clara. A cor do estado inativo passou para `inactiveProps`.
    const { medidas, pulados } = varrerSidebar('/relatorios/consumo-planos')

    expect(pulados).toEqual([])
    expect(reprovacoesAA(medidas)).toEqual([])
    expect(razaoDoTexto(medidas, 'Consumo de Planos').toFixed(2)).toBe('6.99')
  })

  it('nenhum elemento carrega DUAS classes de cor — `clsx` não desempata cor', () => {
    // Trava estrutural do ponto cego nº 5 da demanda 125, derivada do DOM (nunca de uma
    // lista de seletores): quem desempata classe de cor conflitante é a ordem da folha
    // gerada, não o componente. Vale nos dois estados.
    for (const ativa of ['', '/relatorios/consumo-planos', '/']) {
      const { container } = (() => {
        rotaAtiva.valor = ativa
        setRole({ isCoordenadorOuAcima: true, isGerentePlus: true })
        return render(<Sidebar isCollapsed={false} />)
      })()

      const conflitantes = Array.from(container.querySelectorAll('*'))
        // `className` de SVG é `SVGAnimatedString`, não string — e SVG aqui é decorativo.
        .filter((el): el is HTMLElement => typeof el.className === 'string')
        .map((el) => ({
          classe: el.className,
          // 125/FE-A11Y-5: uma cor NÃO MODELÁVEL (`text-[#hex]`, `text-token/[0.3]`) conta
          // como cor para efeito de conflito. Sem ela, esta varredura via um elemento com
          // `text-white text-[#b3c1ca]` como tendo UMA cor só — justamente o caso em que o
          // desempate importa, e o que sobra é o pior dos dois.
          cores: [
            ...coresDeTextoDaClasse(el.className, TEMA).map((c) => c.classe),
            ...(classeDeTextoNaoModelavel(el.className, TEMA) === null ? [] : ['(não modelável)']),
          ],
        }))
        .filter((el) => el.cores.length > 1)

      expect(conflitantes, `rota ativa "${ativa}"`).toEqual([])
      cleanup()
    }
  })

  it('COMPANHEIRA POSITIVA: o `/60` de antes REPROVA na mesma execução', () => {
    // Sem ela, "0 reprovações" seria indistinguível de um medidor que parou de medir o
    // gradiente. `/60` é o valor exato que a sidebar tinha antes da 125/FE-A11Y-3.
    const fora = document.createElement('div')
    fora.innerHTML =
      '<nav class="bg-grad-escuro"><span class="text-white/60">Dashboards</span></nav>'
    document.body.appendChild(fora)

    const { medidas } = varrer(fora)
    expect(razaoDoTexto(medidas, 'Dashboards').toFixed(2)).toBe('4.33')
    expect(reprovacoesAA(medidas)).toHaveLength(1)

    fora.remove()
  })
})

/**
 * 126/FE-FOCO — **o anel de foco da barra, medido no DOM sobre o gradiente.**
 *
 * O achado `Q-125-5` do QA da 125 nasceu aqui: `Tab` chegava no link "Consumo de Planos" e
 * o anel (`outline: 2px solid var(--color-primary)`, `#002f4f`) não se distinguia do
 * `bg-grad-escuro`. O piso de um indicador de foco é o **não-textual**, 3:1 (WCAG 1.4.11),
 * e o anel media 1,53:1 na ponta clara e 1,00:1 na escura.
 *
 * A `Sidebar` declarava `focus-visible:ring-2 ring-white/70 ring-offset-2` — um anel branco,
 * correto para este fundo — e ele **não aparecia**: `ring-offset-2 + ring-2` ocupa a mesma
 * faixa de 2px a 4px que `outline` + `outline-offset: 2px`, e `outline` é pintado por cima
 * de `box-shadow`. A correção mora no `global.css` (uma camada clara colada no elemento,
 * uma escura por fora) e vale para a app inteira; estes casos provam que ela **chega aqui**.
 */
describe('Sidebar — anel de foco sobre o gradiente (126/FE-FOCO)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    rotaAtiva.valor = ''
  })

  function varrerFocoDaSidebar(ativa: string) {
    rotaAtiva.valor = ativa
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: true })
    render(<Sidebar isCollapsed={false} />)
    return varrerAnel(document.body)
  }

  it('todo focável da barra é medido sobre as DUAS pontas — e nada é pulado', () => {
    const { medidas, pulados } = varrerFocoDaSidebar('')

    // `pulados` vazio é o que transforma "não sei medir" em reprovação: se o medidor
    // deixar de modelar o gradiente, os focáveis somem daqui em vez de passarem.
    expect(pulados).toEqual([])
    // Links + botões de grupo da barra, cada um medido uma vez por parada do gradiente.
    expect(medidas.length).toBeGreaterThan(20)
    expect(Array.from(new Set(medidas.map((m) => m.fundo))).sort()).toEqual([
      '#002f4f',
      '#074b7f',
    ])
  })

  it('o link do achado passa a 9,04:1 — era 1,53:1 na mesma ponta', () => {
    const { medidas } = varrerFocoDaSidebar('')

    expect(reprovacoesDoAnel(medidas)).toEqual([])
    // O número, e sempre o pior ponto (a ponta clara do gradiente).
    expect(razaoDoAlvo(medidas, 'Consumo de Planos').toFixed(2)).toBe('9.04')
    expect(fundosDoAlvo(medidas, 'Consumo de Planos')).toEqual(['#002f4f', '#074b7f'])
    // Quem carrega o contraste aqui é a camada CLARA; a escura é a que sumia no fundo.
    const naPontaClara = medidas.filter(
      (m) => m.alvo.includes('Consumo de Planos') && m.fundo === '#074b7f',
    )
    expect(naPontaClara).toHaveLength(1)
    expect(naPontaClara[0].porCamada.map((c) => `${c.token} ${c.razao.toFixed(2)}`)).toEqual([
      '--color-white 9.04',
      '--color-primary 1.53',
    ])
  })

  it('estado ATIVO: o item selecionado também passa (o fundo dele é mais claro)', () => {
    // `activeProps` acrescenta `bg-white/15`, então o fundo atrás do anel muda. É um fundo
    // a mais, e ele entra na medição sozinho — nenhuma lista de superfícies à mão.
    const { medidas, pulados } = varrerFocoDaSidebar('/relatorios/consumo-planos')

    expect(pulados).toEqual([])
    expect(reprovacoesDoAnel(medidas)).toEqual([])
    expect(razaoDoAlvo(medidas, 'Consumo de Planos')).toBeGreaterThanOrEqual(PISO_NAO_TEXTUAL)
  })

  it('CONTROLE POSITIVO: o anel de ANTES reprova em TODOS os focáveis da barra', () => {
    // Sem esta metade, "nenhuma reprovação" seria indistinguível de uma varredura que
    // parou de alcançar a `Sidebar` — que é literalmente o que aconteceu por quatro
    // unidades da demanda 125. É a reversão EXATA do defeito, e ela derruba a barra
    // inteira, não um caso escolhido a dedo.
    const anelAntigo = anelDeFocoDoCss(
      ':focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }',
      TOKENS,
    )
    rotaAtiva.valor = ''
    setRole({ isCoordenadorOuAcima: true, isGerentePlus: true })
    render(<Sidebar isCollapsed={false} />)
    const { medidas, pulados } = medirAnelDeFoco(document.body, {
      tema: TEMA,
      padroes: PADROES,
      anel: anelAntigo,
    })

    expect(pulados).toEqual([])
    expect(reprovacoesDoAnel(medidas)).toHaveLength(medidas.length)
    expect(razaoDoAlvo(medidas, 'Consumo de Planos').toFixed(2)).toBe('1.00')
  })
})
