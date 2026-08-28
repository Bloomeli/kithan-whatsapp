import { IosToggle } from '../ui/IosToggle'

interface InsuranceFieldsProps {
  insuranceDamage: boolean
  disabled?: boolean
  compact?: boolean
  onInsuranceChange: (value: boolean) => void
}

export function InsuranceFields({
  insuranceDamage,
  disabled = false,
  compact = false,
  onInsuranceChange,
}: InsuranceFieldsProps) {
  const labelClass = compact
    ? 'text-[11px] font-medium text-neutral-400'
    : 'text-sm font-medium text-neutral-200'

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className={`min-w-0 ${labelClass}`}>Versicherungsschaden</span>
      <IosToggle
        checked={insuranceDamage}
        disabled={disabled}
        onChange={onInsuranceChange}
      />
    </div>
  )
}
