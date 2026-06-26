/**
 * Barra de filtros dos dashboards.
 * Reutiliza PeriodFilter, ClientCombobox, PlanCombobox da fundação 002.
 * TeamCombobox customizado: "Global" + equipes filtradas por gerencia.
 * NUNCA hardcoda nome de equipe — a lista vem de TeamDto[].
 */

import React, { useId } from 'react'
import { clsx } from 'clsx'
import { Combobox } from '../../../../components/ui/Combobox'
import { PeriodFilter } from '../../../reports/shared/components/PeriodFilter'
import { ClientCombobox } from '../../../reports/shared/components/ClientCombobox'
import { PlanCombobox } from '../../../reports/shared/components/PlanCombobox'
import type { MetricsScope, TeamDto } from '../types/metrics'
import { usePermissions } from '../../../../hooks/usePermissions'

type DashboardFiltersProps = {
  // Período
  from: string | null
  to: string | null
  onPeriodChange: (from: string | null, to: string | null) => void

  // Equipe — só para Dashboard Suporte
  teams?: TeamDto[]
  selectedScope?: MetricsScope
  onScopeChange?: (scope: MetricsScope) => void
  isTeamsLoading?: boolean

  // Cliente e Plano (opcionais)
  clientId?: string | null
  onClientChange?: (id: string | null) => void
  supportPlanId?: string | null
  onPlanChange?: (id: string | null) => void

  // Modo Painel
  onPresentar?: () => void
  showPresentar?: boolean

  /** Tempo por tela no Modo Painel, em segundos (4–180, default 12). */
  panelSeconds?: number
  /** Callback ao alterar o tempo por tela (já validado: clamp 4–180). */
  onPanelSecondsChange?: (seconds: number) => void

  /**
   * Ref opcional para o botão "Apresentar".
   * Usado para devolver o foco ao sair do Modo Painel (AP-FRONTEND-004).
   * Retrocompat: quem não passa a prop não é afetado.
   */
  apresentarButtonRef?: React.RefObject<HTMLButtonElement | null>

  className?: string
}

/**
 * Constrói o scope a partir do valor selecionado do combobox de equipe.
 * '' (Global) → 'management:suporte'; teamId → 'team:{id}'.
 */
function buildScope(value: string): MetricsScope {
  if (!value) return 'management:suporte'
  return `team:${value}` as MetricsScope
}

/** Extrai o teamId do scope (ou '' para global/management) */
function scopeToComboboxValue(scope: MetricsScope | undefined): string {
  if (!scope) return ''
  if (scope.startsWith('team:')) return scope.slice(5)
  return ''
}

export function DashboardFilters({
  from,
  to,
  onPeriodChange,
  teams,
  selectedScope,
  onScopeChange,
  isTeamsLoading,
  clientId,
  onClientChange,
  supportPlanId,
  onPlanChange,
  onPresentar,
  showPresentar,
  panelSeconds,
  onPanelSecondsChange,
  apresentarButtonRef,
  className,
}: DashboardFiltersProps) {
  const { isCoordenadorOuAcima } = usePermissions()
  const teamComboId = useId()
  const panelSecondsId = useId()

  const showPanelControls =
    showPresentar && !!onPresentar && isCoordenadorOuAcima

  const teamOptions = [
    { value: '', label: 'Global' },
    ...(teams ?? []).map((t) => ({ value: String(t.id), label: t.nome })),
  ]

  return (
    <div
      className={clsx(
        'flex flex-wrap items-end gap-3 mb-4',
        className,
      )}
    >
      {/* Período */}
      <PeriodFilter from={from} to={to} onChange={onPeriodChange} />

      {/* Equipe (apenas quando teams é fornecido) — largura ×2 (019) */}
      {teams !== undefined && onScopeChange && (
        <Combobox
          label="Equipe"
          value={scopeToComboboxValue(selectedScope)}
          options={teamOptions}
          onChange={(val) => onScopeChange(buildScope(val))}
          placeholder="Global"
          id={teamComboId}
          isLoading={isTeamsLoading}
          className="w-full sm:w-64 lg:w-80"
        />
      )}

      {/* Cliente — largura ×2 (019) via wrapper; sem CNPJ no rótulo, busca por CNPJ mantida */}
      {onClientChange && (
        <div className="w-full sm:w-72 lg:w-88">
          <ClientCombobox
            value={clientId ?? null}
            onChange={onClientChange}
            showCnpj={false}
          />
        </div>
      )}

      {/* Plano — largura +30% (019) via wrapper */}
      {onPlanChange && (
        <div className="w-full sm:w-48 lg:w-56">
          <PlanCombobox
            value={supportPlanId ?? null}
            onChange={onPlanChange}
          />
        </div>
      )}

      {/* Tempo/tela — controle do Modo Painel (espelha o input do protótipo) */}
      {showPanelControls && onPanelSecondsChange && (
        <div className="flex flex-col">
          <label
            htmlFor={panelSecondsId}
            className="mb-0.5 text-xs lg:text-sm font-normal text-foreground"
          >
            Tempo/tela
          </label>
          <div className="flex items-center gap-1">
            <input
              id={panelSecondsId}
              type="number"
              min={4}
              max={180}
              value={panelSeconds ?? 12}
              onChange={(e) => {
                const raw = Number(e.target.value)
                const clamped = Math.max(4, Math.min(180, Number.isFinite(raw) ? raw : 12))
                onPanelSecondsChange(clamped)
              }}
              className={clsx(
                'h-9 w-[76px] rounded-[5px] border border-border bg-card px-3',
                'text-sm text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
              title="Segundos que cada tela fica no painel (35% no topo, 30% rolando, 35% no fim)"
            />
            <span className="text-sm text-muted">s</span>
          </div>
        </div>
      )}

      {/* Botão Apresentar */}
      {showPanelControls && (
        <button
          ref={apresentarButtonRef}
          type="button"
          onClick={onPresentar}
          className={clsx(
            'flex items-center gap-2 h-9 rounded-[5px] border border-border bg-background',
            'px-3 text-sm font-semibold text-foreground',
            'hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] transition-shadow duration-150',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
          )}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          Apresentar
        </button>
      )}
    </div>
  )
}
