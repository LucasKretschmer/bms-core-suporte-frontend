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

function setRole(opts: { isCoordenadorOuAcima: boolean; isGerentePlus: boolean }) {
  mockUsePermissions.mockReturnValue({
    role: null,
    isCoordenadorOuAcima: opts.isCoordenadorOuAcima,
    isGerentePlus: opts.isGerentePlus,
    isAtendente: !opts.isCoordenadorOuAcima,
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
