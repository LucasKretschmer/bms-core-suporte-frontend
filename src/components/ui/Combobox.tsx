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

  // Cache de rótulos já vistos {value→label}. No modo async, a lista de `options`
  // muda a cada busca (ao fechar, o effect reseta search='' → refetch traz os 25
  // primeiros). Se o item selecionado não estiver nessa lista, o rótulo se perderia
  // e o trigger voltaria ao placeholder. O cache mantém o rótulo do selecionado
  // independentemente da lista atual.
  const labelCacheRef = useRef<Map<string, string>>(new Map())
  for (const opt of options) {
    labelCacheRef.current.set(opt.value, opt.label)
  }

  const selectedLabel =
    value === null
      ? null
      : (options.find((o) => o.value === value)?.label ??
        labelCacheRef.current.get(value) ??
        null)

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
    // Fixa o rótulo do selecionado no cache antes de fechar — garante que o trigger
    // mostre o nome mesmo que o refetch async (search vazio) não retorne este item.
    const picked = options.find((o) => o.value === val)
    if (picked) labelCacheRef.current.set(picked.value, picked.label)
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

  const height = size === 'sm' ? 'h-8' : 'h-[42px]'

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
        <span className={clsx('truncate', !selectedLabel && 'text-muted')}>
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
            'absolute z-50 w-full min-w-[180px] bg-white border border-line rounded-input shadow-panel',
            'origin-top animate-[scaleY_0.1s_ease-out]',
            openUp ? 'bottom-full mb-1' : 'top-full mt-1',
            alignRight && 'right-0 left-auto',
          )}
        >
          {/* Campo de busca */}
          <div className="p-2 border-b border-line">
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
              className="w-full h-8 px-2 rounded border-[0.8px] border-border text-sm bg-card text-foreground placeholder:text-muted outline-none focus:border-[1.5px] focus:border-primary-medium"
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
              <li className="px-3 py-2 text-sm text-muted text-center">
                Carregando…
              </li>
            )}
            {!isLoading && filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted text-center italic">
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
                    'rounded-input px-3 py-[9px] text-sm cursor-pointer text-ink',
                    idx === activeIndex && 'bg-surface-hover',
                    opt.value === value && 'font-medium',
                    'hover:bg-surface-hover transition-colors duration-100',
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
