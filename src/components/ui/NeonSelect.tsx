import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

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
}

export function NeonSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Bitte wählen',
  fieldClass,
}: NeonSelectProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const selected = options.find((option) => option.value === value)

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const maxHeight = 224
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const openUpward = spaceBelow < 160 && rect.top > spaceBelow
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight,
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
    })
  }, [open])

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClass} flex items-center text-left`}
      >
        <span className={`min-w-0 truncate ${selected ? 'text-white' : 'text-neutral-500'}`}>
          {selected?.label ?? placeholder}
        </span>
      </button>
      {open ? (
        <ul
          ref={menuRef}
          role="listbox"
          style={menuStyle}
          className="z-50 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl"
        >
          {options.map((option) => {
            const checked = option.value === value
            return (
              <li key={option.value} className="border-b border-neutral-800 last:border-b-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                >
                  <span className="min-w-0 flex-1 text-sm text-white">{option.label}</span>
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-primary bg-transparent"
                  >
                    {checked ? <CheckIcon /> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function CheckIcon() {
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
