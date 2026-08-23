interface IosToggleProps {
  checked: boolean
  disabled?: boolean
  onLabel?: string
  offLabel?: string
  onChange: (checked: boolean) => void
}

export function IosToggle({
  checked,
  disabled = false,
  onLabel = 'Ja',
  offLabel = 'Nein',
  onChange,
}: IosToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 disabled:opacity-40"
    >
      <span
        className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-neutral-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-7 w-7 rounded-full bg-white shadow transition-[left] ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
      <span className={`text-sm font-medium ${checked ? 'text-primary' : 'text-neutral-400'}`}>
        {checked ? onLabel : offLabel}
      </span>
    </button>
  )
}
