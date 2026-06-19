import { clsx } from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'

export type ComboboxOption = { value: string; label: string }

type ComboboxProps = {
  id?: string
  value: string | null
  options: ComboboxOption[]
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  required?: boolean
  disabled?: boolean
  className?: string
  openUp?: boolean
  alignRight?: boolean
  size?: 'default' | 'sm'
  isAsync?: boolean
  onSearch?: (query: string) => void
  isLoading?: boolean
}

/**
 * Combobox com busca — substitui todo <select> nativo.
 * Acessível: role=combobox, aria-expanded, setas ↑↓, Enter, Escape.
 * Modo async: onSearch + debounce 300ms gerenciado externamente.
 */
export function Combobox({
  id: idProp,
  value,
  options,
  onChange,
  placeholder = 'Selecione…',
  label,
  error,
  required,
  disabled,
  className,
  openUp = false,
  alignRight = false,
  size = 'default',
  isAsync = false,
  onSearch,
  isLoading = false,
}: ComboboxProps) {
  const genId = useId()
  const id = idProp ?? genId
  const listboxId = `${id}-listbox`

  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? null

  const filteredOptions = isAsync
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))

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

  // Foca o campo de busca ao abrir
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(-1)
      searchRef.current?.focus()
    } else {
      setSearch('')
    }
  }, [isOpen])

  // Debounce de busca async
  useEffect(() => {
    if (!isAsync || !onSearch) return
    const timer = setTimeout(() => onSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search, isAsync, onSearch])

  function open() {
    if (!disabled) setIsOpen(true)
  }

  function selectOption(val: string) {
    onChange(val)
    setIsOpen(false)
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && filteredOptions[activeIndex]) {
        selectOption(filteredOptions[activeIndex].value)
      } else if (filteredOptions.length === 1) {
        selectOption(filteredOptions[0].value)
      }
    }
  }

  const height = size === 'sm' ? 'h-8' : 'h-9'

  return (
    <div ref={containerRef} className={clsx('relative flex flex-col space-y-0.5', className)}>
      {label && (
        <label htmlFor={id} className="text-xs lg:text-sm font-normal text-foreground">
          {required && <span className="text-error-fg mr-1" aria-hidden="true">*</span>}
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleTriggerKeyDown}
        className={clsx(
          'flex items-center justify-between w-full rounded-[5px] border border-border',
          'px-3 text-sm bg-card cursor-pointer',
          height,
          isOpen && 'border-[#666]',
          error && 'border-error-fg',
          disabled && 'opacity-50 cursor-not-allowed',
          'hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] transition-shadow duration-150',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        )}
      >
        <span className={clsx('truncate', !selectedLabel && 'text-foreground/40')}>
          {selectedLabel ?? placeholder}
        </span>
        <svg
          aria-hidden="true"
          className={clsx('ml-2 h-4 w-4 shrink-0 text-muted transition-transform', isOpen && 'rotate-180')}
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
            'absolute z-50 w-full min-w-[180px] bg-card border border-border rounded-[5px] shadow-sm',
            'origin-top animate-[scaleY_0.1s_ease-out]',
            openUp ? 'bottom-full mb-1' : 'top-full mt-1',
            alignRight && 'right-0 left-auto',
          )}
        >
          {/* Campo de busca */}
          <div className="p-2 border-b border-border">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setActiveIndex(-1)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Filtrar…"
              className="w-full h-8 px-2 rounded border border-border text-sm bg-card text-foreground placeholder:text-foreground/40 outline-none focus:border-[#666]"
            />
          </div>

          {/* Lista de opções */}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="max-h-52 overflow-y-auto"
          >
            {isLoading && (
              <li className="px-3 py-2 text-sm text-foreground/50 text-center">
                Carregando…
              </li>
            )}
            {!isLoading && filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-foreground/50 text-center italic">
                Nenhum resultado.
              </li>
            )}
            {!isLoading &&
              filteredOptions.map((opt, idx) => (
                <li
                  key={opt.value}
                  id={`${id}-option-${idx}`}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => selectOption(opt.value)}
                  className={clsx(
                    'px-3 py-1.5 text-sm cursor-pointer text-black',
                    idx === activeIndex && 'bg-[#F8F8F8]',
                    opt.value === value && 'font-medium',
                    'hover:bg-[#F8F8F8] transition-colors duration-100',
                  )}
                >
                  {opt.label}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
