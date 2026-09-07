import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { useState } from 'react'
import { usePermissions } from '../../hooks/usePermissions'

type SidebarProps = {
  isCollapsed: boolean
}

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  /**
   * Renomeado de `requiresCoordenadorPlus` (118.6) — evita ambiguidade agora que
   * parte dos itens antes restritos a Coordenador+ ficou visível ao atendente
   * (Dashboards/Suporte, Consumo de Planos). No modelo binário atendente × gerente,
   * esta flag decide via `isGestor` (não-atendente autenticado).
   */
  requiresGestor?: boolean
  requiresGerentePlus?: boolean
}

/** Ícone de gráfico de barras para o grupo Dashboards */
const ChartBarsIcon = (
  <svg
    aria-hidden="true"
    className="h-4 w-4 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)

const dashboardItems: NavItem[] = [
  {
    label: 'Suporte',
    href: '/dashboards/suporte',
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
  {
    label: 'Onboarding',
    href: '/dashboards/onboarding',
    requiresGestor: true,
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
]

const reportItems: NavItem[] = [
  {
    label: 'Consumo de Planos',
    href: '/relatorios/consumo-planos',
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Apontamentos por Ticket',
    href: '/relatorios/apontamentos',
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Apontamentos por Projeto',
    href: '/relatorios/apontamentos-projeto',
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Relatório do Cliente',
    href: '/relatorios/cliente',
    requiresGestor: true,
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    label: 'Produtividade',
    href: '/relatorios/produtividade',
    requiresGestor: true,
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    label: 'Movimentação Diária',
    href: '/relatorios/movimentacao-diaria',
    requiresGestor: true,
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l4-4 3 3 5-6" />
      </svg>
    ),
  },
]

/**
 * Sidebar do Design System BMS.
 * Estado colapsável persistido em localStorage (preferência de UI).
 * Visibilidade de itens `requiresGestor` controlada por usePermissions() — modelo
 * binário atendente × gerente (118.6).
 * O backend é a fonte de verdade — a guarda é apenas UX.
 */
/** Itens do grupo Administração — gestão de configurações (exclusivo de gestor) */
const administracaoItems: NavItem[] = [
  {
    label: 'Categorias',
    href: '/categorias',
    requiresGestor: true,
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 8V3a2 2 0 012-2h2z" />
      </svg>
    ),
  },
  {
    // 124/F1 — cadastro de planos de suporte (horas/mês, meta de 1º atendimento,
    // calendário e identificador do HubSpot). `GET /support-plans` exige CoordenadorPlus
    // (`SupportPlansController.cs:29`), coberto por `requiresGestor` no modelo binário.
    label: 'Planos',
    href: '/planos',
    requiresGestor: true,
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    // 124/F2+F3 — calendário comercial: expediente versionado por vigência e feriados
    // (a origem do tempo útil do SLA). `GET /calendars` exige CoordenadorPlus
    // (`CalendarsController.cs`), coberto por `requiresGestor` no modelo binário.
    label: 'Calendário',
    href: '/calendario',
    requiresGestor: true,
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    label: 'Equipes e Atendentes',
    href: '/equipes',
    requiresGestor: true,
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Configurações',
    href: '/configuracoes',
    requiresGestor: true,
    icon: (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

/** Itens de administração (visíveis apenas para GerentePlus) */
const adminItems: NavItem[] = [
  {
    label: 'Sincronizador',
    href: '/sincronizador',
    requiresGerentePlus: true,
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
]

/**
 * Classe dos TÍTULOS DE GRUPO da sidebar ("Dashboards", "Relatórios", "Administração").
 *
 * 125/FE-A11Y-3 — era `text-white/60`. O fundo da sidebar é `bg-grad-escuro`, um
 * **gradiente** (`linear-gradient(99deg, #074b7f 2.24%, #002f4f 93.71%)`, declarado em
 * `@migrate/design-system/tokens.css`), então o contraste do texto varia AO LONGO da barra
 * e o veredito é o do pior caso — a ponta CLARA:
 *
 *                        sobre #074b7f (clara)   sobre #002f4f (escura)
 *   text-white/60              4,33:1  ❌               5,89:1  ✅
 *   text-white/70              5,31:1  ✅               7,50:1  ✅
 *
 * Ninguém tinha medido este ponto até a 125/FE-A11Y-3: a varredura de contraste do repo não
 * modelava `background-image` nenhum. Desde a 125/FE-A11Y-4 (`Q-3`) ela **modela o
 * gradiente por parada** — `utils/contrasteDeTexto.ts` deriva as paradas do `@utility
 * bg-grad-escuro` + `--grad-escuro` da cascata real e mede uma vez por ponta, então a barra
 * inteira é varrida no DOM em `Sidebar.test.tsx`, sem hex digitado em lugar nenhum.
 *
 * As três chamadas usam esta constante para que o valor não possa divergir entre os grupos.
 */
const CLASSE_TITULO_DE_GRUPO = 'text-white/70 text-aux font-medium uppercase tracking-wide'

export function Sidebar({ isCollapsed }: SidebarProps) {
  const [dashboardsOpen, setDashboardsOpen] = useState(true)
  const [reportsOpen, setReportsOpen] = useState(true)
  const [administracaoOpen, setAdministracaoOpen] = useState(true)
  const { isGestor, isGerentePlus } = usePermissions()

  const visibleDashboardItems = dashboardItems.filter(
    (item) => !item.requiresGestor || isGestor,
  )

  const visibleReportItems = reportItems.filter(
    (item) => !item.requiresGestor || isGestor,
  )

  const visibleAdministracaoItems = administracaoItems.filter(
    (item) => !item.requiresGestor || isGestor,
  )

  const visibleAdminItems = adminItems.filter(
    (item) => !item.requiresGerentePlus || isGerentePlus,
  )

  return (
    <nav
      aria-label="Menu principal"
      className={clsx(
        'flex flex-col bg-grad-escuro rounded-card shadow-panel h-full p-3 text-white transition-all duration-200 shrink-0',
        isCollapsed ? 'w-[86px]' : 'w-72',
      )}
    >
      {/* Logo / nome */}
      <div className="h-14 flex items-center justify-center border-b border-white/15 px-3">
        {isCollapsed ? (
          <span className="text-white font-extrabold text-lg">B</span>
        ) : (
          <span className="text-white font-extrabold text-sm truncate px-2">
            {import.meta.env.VITE_APP_NAME ?? 'BMS Core Suporte'}
          </span>
        )}
      </div>

      {/* Itens de menu */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0">
        {/* Dashboard */}
        <NavLink href="/" isCollapsed={isCollapsed} icon={
          <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        }>
          Dashboard
        </NavLink>

        {/* Grupo: Dashboards — visibilidade 100% controlada pelos itens individuais (118.6) */}
        {visibleDashboardItems.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setDashboardsOpen((prev) => !prev)}
              aria-expanded={dashboardsOpen}
              className={clsx(
                'flex items-center w-full h-10 gap-2 rounded-control px-3',
                isCollapsed ? 'justify-center' : 'justify-between',
                CLASSE_TITULO_DE_GRUPO,
                'hover:bg-white/10 hover:text-white hover:shadow-hover transition',
                'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              )}
            >
              {!isCollapsed && <span>Dashboards</span>}
              {isCollapsed && ChartBarsIcon}
              {!isCollapsed && (
                <svg
                  aria-hidden="true"
                  className={clsx('h-3 w-3 transition-transform', !dashboardsOpen && '-rotate-90')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {dashboardsOpen && (
              <div className="mt-1">
                {visibleDashboardItems.map((item) => (
                  <SubNavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    isCollapsed={isCollapsed}
                  >
                    {item.label}
                  </SubNavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grupo: Relatórios */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setReportsOpen((prev) => !prev)}
            aria-expanded={reportsOpen}
            className={clsx(
              'flex items-center w-full h-10 gap-2 rounded-control px-3',
              isCollapsed ? 'justify-center' : 'justify-between',
              CLASSE_TITULO_DE_GRUPO,
              'hover:bg-white/10 hover:text-white hover:shadow-hover transition',
              'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
            )}
          >
            {!isCollapsed && <span>Relatórios</span>}
            {isCollapsed && (
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {!isCollapsed && (
              <svg
                aria-hidden="true"
                className={clsx('h-3 w-3 transition-transform', !reportsOpen && '-rotate-90')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          {reportsOpen && (
            <div className="mt-1">
              {visibleReportItems.map((item) => (
                <SubNavLink key={item.href} href={item.href} icon={item.icon} isCollapsed={isCollapsed}>
                  {item.label}
                </SubNavLink>
              ))}
            </div>
          )}
        </div>

        {/* Grupo: Administração — gestão de configurações (exclusivo de gestor) */}
        {visibleAdministracaoItems.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setAdministracaoOpen((prev) => !prev)}
              aria-expanded={administracaoOpen}
              className={clsx(
                'flex items-center w-full h-10 gap-2 rounded-control px-3',
                isCollapsed ? 'justify-center' : 'justify-between',
                CLASSE_TITULO_DE_GRUPO,
                'hover:bg-white/10 hover:text-white hover:shadow-hover transition',
                'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              )}
            >
              {!isCollapsed && <span>Administração</span>}
              {isCollapsed && (
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              )}
              {!isCollapsed && (
                <svg
                  aria-hidden="true"
                  className={clsx('h-3 w-3 transition-transform', !administracaoOpen && '-rotate-90')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {administracaoOpen && (
              <div className="mt-1">
                {visibleAdministracaoItems.map((item) => (
                  <SubNavLink key={item.href} href={item.href} icon={item.icon} isCollapsed={isCollapsed}>
                    {item.label}
                  </SubNavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Itens de administração (GerentePlus) */}
        {visibleAdminItems.length > 0 && (
          <div className="mt-2">
            {visibleAdminItems.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} isCollapsed={isCollapsed}>
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

type NavLinkProps = {
  href: string
  icon: React.ReactNode
  isCollapsed: boolean
  children: React.ReactNode
}

/**
 * 125/FE-A11Y-4 — a cor do estado INATIVO mora em `inactiveProps`, nunca no `className`
 * base.
 *
 * O `activeProps` do TanStack Router **acrescenta** classes; ele não substitui as do
 * `className`. Com a cor no base, o item ativo renderizava as DUAS (`text-white/70` **e**
 * `text-white`), e `clsx` não desempata classe de cor conflitante — quem desempata é a
 * ordem da folha gerada pelo Tailwind, onde `.text-white` vem ANTES de `.text-white\/70`.
 * Ou seja: no item ativo o `/70` vencia o `text-white` do `activeProps` (o realce ficava
 * pela metade) e o texto media **4,33:1 na ponta clara do gradiente** — abaixo do piso AA,
 * medido no DOM em `Sidebar.test.tsx`. Com a cor em `inactiveProps`, exatamente **uma**
 * classe de cor existe em cada estado, e não há o que desempatar.
 */
function NavLink({ href, icon, isCollapsed, children }: NavLinkProps) {
  return (
    <Link
      to={href}
      className={clsx(
        'flex items-center h-10 gap-2.5 rounded-control px-3',
        'hover:bg-white/10 hover:text-white hover:shadow-hover transition',
        'text-sm focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        isCollapsed ? 'justify-center' : '',
      )}
      inactiveProps={{ className: 'text-white/80' }}
      activeProps={{ className: 'bg-white/15 text-white font-semibold border-l-2 border-accent' }}
      title={isCollapsed ? String(children) : undefined}
    >
      {icon}
      {!isCollapsed && <span className="truncate">{children}</span>}
    </Link>
  )
}

function SubNavLink({ href, icon, isCollapsed, children }: NavLinkProps) {
  return (
    <Link
      to={href}
      className={clsx(
        'flex items-center h-9 gap-2 rounded-control text-sm',
        'hover:bg-white/10 hover:text-white hover:shadow-hover transition',
        'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        isCollapsed ? 'px-3 justify-center' : 'ml-6 px-3',
      )}
      inactiveProps={{ className: 'text-white/70' }}
      activeProps={{ className: 'text-white font-semibold bg-white/10' }}
      title={isCollapsed ? String(children) : undefined}
    >
      {icon}
      {!isCollapsed && <span className="truncate">{children}</span>}
    </Link>
  )
}
