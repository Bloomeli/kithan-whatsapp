import { IosToggle } from '../ui/IosToggle'

const SITUATION_CLASS =
  'min-h-[4.5rem] w-full resize-none rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-50'

interface InsuranceFieldsProps {
  insuranceDamage: boolean
  situation: string
  disabled?: boolean
  compact?: boolean
  onInsuranceChange: (value: boolean) => void
  onSituationChange: (value: string) => void
  onSituationBlur?: () => void
}

export function InsuranceFields({
  insuranceDamage,
  situation,
  disabled = false,
  compact = false,
  onInsuranceChange,
  onSituationChange,
  onSituationBlur,
}: InsuranceFieldsProps) {
  const labelClass = compact
    ? 'text-[11px] font-medium text-neutral-400'
    : 'text-sm font-medium text-neutral-200'

  return (
    <div className={compact ? 'flex flex-col gap-1' : 'flex flex-col gap-2'}>
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>Versicherungsschaden</span>
        <IosToggle
          checked={insuranceDamage}
          disabled={disabled}
          onChange={onInsuranceChange}
        />
      </div>

      {insuranceDamage ? (
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Situation</span>
          <textarea
            value={situation}
            disabled={disabled}
            rows={compact ? 3 : 4}
            placeholder="Was ist passiert? Kurz für Rita und Bercem."
            onChange={(event) => onSituationChange(event.target.value)}
            onBlur={onSituationBlur}
            className={SITUATION_CLASS}
          />
          {!situation.trim() ? (
            <span className="text-[11px] text-red-300">
              Bitte die Situation schildern.
            </span>
          ) : null}
        </label>
      ) : null}
    </div>
  )
}
