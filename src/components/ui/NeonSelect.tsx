import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

interface NeonSelectOption {
  value: string
  label: string
}

interface NeonSelectProps {
  value: string
  options: NeonSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  fieldClass: string
  selectedClass?: string
  /** Custom panel below the field (chevron, neon-blue check). */
  variant?: 'default' | 'dropdown'
}

export function NeonSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Bitte wählen',
  fieldClass,
  selectedClass,
  variant = 'default',
}: NeonSelectProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const selected = options.find((option) => option.value === value)
  const isDropdown = variant === 'dropdown'

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return

    function placeMenu() {
      if (!rootRef.current) return
      const rect = rootRef.current.getBoundingClientRect()
      const gap = 4
      const preferred = isDropdown ? 280 : 224
      const spaceBelow = window.innerHeight - rect.bottom - 8

      if (isDropdown) {
        setMenuStyle({
          position: 'fixed',
          left: rect.left,
          width: rect.width,
          top: rect.bottom + gap,
          maxHeight: Math.max(120, Math.min(preferred, spaceBelow)),
        })
        return
      }

      const openUpward = spaceBelow < 160 && rect.top > spaceBelow
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        maxHeight: preferred,
        top: openUpward ? undefined : rect.bottom + gap,
        bottom: openUpward ? window.innerHeight - rect.top + gap : undefined,
      })
    }

    placeMenu()
    window.addEventListener('resize', placeMenu)
    window.addEventListener('scroll', placeMenu, true)
    return () => {
      window.removeEventListener('resize', placeMenu)
      window.removeEventListener('scroll', placeMenu, true)
    }
  }, [open, isDropdown])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const menu = open ? (
    <ul
      ref={menuRef}
      role="listbox"
      style={menuStyle}
      className={
        isDropdown
          ? 'z-[80] overflow-y-auto rounded-2xl border border-white/15 bg-neutral-300/80 shadow-2xl backdrop-blur-xl [-webkit-overflow-scrolling:touch]'
          : 'z-50 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl'
      }
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <li
            key={option.value}
            className={
              isDropdown
                ? 'border-b border-black/10 last:border-b-0'
                : 'border-b border-neutral-800 last:border-b-0'
            }
          >
            <button
              type="button"
              role="option"
              aria-selected={checked}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={
                isDropdown
                  ? 'flex w-full items-start gap-3 px-3.5 py-2.5 text-left'
                  : 'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left'
              }
            >
              {isDropdown ? (
                <span
                  aria-hidden
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center"
                >
                  {checked ? <DropdownCheck /> : null}
                </span>
              ) : null}
              <span
                className={
                  isDropdown
                    ? 'min-w-0 flex-1 text-[15px] leading-snug text-black'
                    : 'min-w-0 flex-1 text-sm text-white'
                }
              >
                {option.label}
              </span>
              {isDropdown ? null : (
                <span
                  aria-hidden
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-primary bg-transparent"
                >
                  {checked ? <BoxCheck /> : null}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  ) : null

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClass} flex min-w-0 items-center text-left ${
          isDropdown ? 'relative pr-11' : ''
        } ${open && isDropdown ? '!border-primary' : ''}`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? (selectedClass ?? 'text-white') : 'text-neutral-500'
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        {isDropdown ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-primary"
          >
            <ChevronDown />
          </span>
        ) : null}
      </button>
      {open
        ? isDropdown && typeof document !== 'undefined'
          ? createPortal(menu, document.body)
          : menu
        : null}
    </div>
  )
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 12 8" className="h-2.5 w-3" fill="currentColor" aria-hidden>
      <path d="M0 1.2 6 7.2 12 1.2 10.6 0 6 4.5 1.4 0z" />
    </svg>
  )
}

function DropdownCheck() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 text-primary" fill="none" aria-hidden>
      <path
        d="M3 8.2 6.4 11.5 13 4.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BoxCheck() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-primary" fill="none" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
