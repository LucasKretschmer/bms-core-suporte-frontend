import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockUsePermissions } = vi.hoisted(() => ({ mockUsePermissions: vi.fn() }))

// Link/anchor simplificado — não precisamos de RouterProvider no teste
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
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
