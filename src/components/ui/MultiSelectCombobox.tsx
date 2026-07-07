import { clsx } from 'clsx'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type MultiSelectOption<T extends string | number> = {
  value: T
  label: string
}

type MultiSelectComboboxProps<T extends string | number> = {
  id?: string
  /** Valores selecionados (controlado). */
  value: T[]
  options: MultiSelectOption<T>[]
  onChange: (value: T[]) => void
  /** Texto exibido no controle quando nada está selecionado. */
  placeholder?: string
  /** Rótulo curto usado no resumo (ex.: "Status" → "Status (2)"). */
  summaryLabel?: string
  label?: string
  disabled?: boolean
  className?: string
  /** Exibe campo de busca dentro do dropdown. */
  searchable?: boolean
  /** Estado de carregamento das opções (fetch externo). */
  isLoading?: boolean
  /** Mensagem de erro do fetch de opções (não quebra a tela). */
  error?: string
  openUp?: boolean
  alignRight?: boolean
  /** Altura do trigger — `default` (42px, padrão) ou `sm` (32px, contextos compactos). */
  size?: 'default' | 'sm'
}

/**
 * Combobox de seleção múltipla com checkboxes.
 *
 * Reutilizável e tipado genericamente sobre o tipo do valor (`string | number`).
 * Acessível:
 * - trigger com role/aria-expanded/aria-haspopup; abre/fecha com Enter/Espaço.
 * - lista com role="listbox" aria-multiselectable; cada item role="option" +
 *   checkbox com aria-checked; navegação por Tab; alterna com Espaço/Enter; Esc fecha.
 * - fecha ao clicar fora.
 *
 * Segue o Design System Migrate (visual do `Select`): altura 42px (32px em `size="sm"`),
 * borda `border-primary-medium` (1.5px) ao abrir/focar, hover por espessamento de borda
 * (campo de formulário — nunca sombra).
 */
export function MultiSelectCombobox<T extends string | number>({
  id: idProp,
  value,
  options,
  onChange,
  placeholder = 'Selecione…',
  summaryLabel,
  label,
  disabled = false,
  className,
  searchable = false,
  isLoading = false,
  error,
  openUp = false,
  alignRight = false,
  size = 'default',
}: MultiSelectComboboxProps<T>) {
  const genId = useId()
  const id = idProp ?? genId
  const listboxId = `${id}-listbox`

  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedSet = useMemo(() => new Set<T>(value), [value])

  const filteredOptions = useMemo(() => {
    if (!searchable || search.trim() === '') return options
    const q = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search, searchable])

  // Resumo exibido no trigger: "Label (N)" ou rótulo do único selecionado.
  const triggerText = useMemo(() => {
    if (value.length === 0) return placeholder
    if (value.length === 1) {
      const only = options.find((o) => o.value === value[0])
      return only?.label ?? `${summaryLabel ?? ''} (1)`.trim()
    }
    return summaryLabel ? `${summaryLabel} (${value.length})` : `${value.length} selecionados`
  }, [value, options, placeholder, summaryLabel])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Foca a busca ao abrir; limpa busca ao fechar
  useEffect(() => {
    if (isOpen) {
      if (searchable) searchRef.current?.focus()
    } else {
      setSearch('')
    }
  }, [isOpen, searchable])

  function open() {
    if (!disabled) setIsOpen(true)
  }

  function toggleOption(optionValue: T) {
    if (selectedSet.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  function handleOptionKeyDown(e: React.KeyboardEvent, optionValue: T) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleOption(optionValue)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const height = size === 'sm' ? 'h-8' : 'h-[42px]'

  return (
    <div ref={containerRef} className={clsx('relative flex flex-col space-y-0.5', className)}>
      {label && (
        <label htmlFor={id} className="text-xs lg:text-sm font-normal text-foreground">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleTriggerKeyDown}
        className={clsx(
          'flex items-center justify-between w-full rounded-input border-[0.8px] border-border',
          'px-3 text-sm bg-card cursor-pointer',
          'transition-[border-color,border-width] duration-150',
          height,
          isOpen && 'border-[1.5px] border-primary-medium',
          error && 'border-error-fg',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'hover:border-primary-medium',
        )}
      >
        <span className={clsx('truncate', value.length === 0 && 'text-muted')}>
          {triggerText}
        </span>
        <svg
          aria-hidden="true"
          className={clsx(
            'ml-2 h-4 w-4 shrink-0 text-muted transition-transform',
            isOpen && 'rotate-180',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {error && (
        <p className="text-xs text-error-fg" role="alert">
          {error}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 w-full min-w-[200px] bg-white border border-line rounded-input shadow-panel',
            'origin-top animate-[scaleY_0.1s_ease-out]',
            openUp ? 'bottom-full mb-1' : 'top-full mt-1',
            alignRight && 'right-0 left-auto',
          )}
        >
          {searchable && (
            <div className="p-2 border-b border-line">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsOpen(false)
                }}
                placeholder="Filtrar…"
                aria-label="Filtrar opções"
                className="w-full h-8 px-2 rounded border-[0.8px] border-border text-sm bg-card text-foreground placeholder:text-muted outline-none focus:border-[1.5px] focus:border-primary-medium"
              />
            </div>
          )}

          <ul
            id={listboxId}
            role="listbox"
            aria-label={label ?? summaryLabel}
            aria-multiselectable="true"
            className="max-h-52 overflow-y-auto py-1"
          >
            {isLoading && (
              <li className="px-3 py-2 text-sm text-muted text-center">Carregando…</li>
            )}
            {!isLoading && filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted text-center italic">
                Nenhum resultado.
              </li>
            )}
            {!isLoading &&
              filteredOptions.map((opt) => {
                const checked = selectedSet.has(opt.value)
                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={checked}
                    aria-checked={checked}
                    tabIndex={0}
                    onClick={() => toggleOption(opt.value)}
                    onKeyDown={(e) => handleOptionKeyDown(e, opt.value)}
                    className={clsx(
                      'flex items-center gap-2 rounded-input px-3 py-[9px] text-sm cursor-pointer text-ink',
                      'hover:bg-surface-hover transition-colors duration-100',
                      'focus-visible:bg-surface-hover focus-visible:outline-none',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        'flex items-center justify-center h-4 w-4 rounded-check border shrink-0',
                        checked ? 'bg-primary-medium border-primary-medium' : 'border-border bg-card',
                      )}
                    >
                      {checked && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </li>
                )
              })}
          </ul>
        </div>
      )}
    </div>
  )
}
