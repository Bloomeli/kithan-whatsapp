import { NeonSelect } from '../ui/NeonSelect'
import { InsuranceFields } from '../tickets/InsuranceFields'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../lib/labels'
import type { TicketPriority, TicketStatus } from '../../types'

const FIELD_CLASS =
  'h-11 w-full appearance-none rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-50'

const SITUATION_CLASS =
  'min-h-[4.25rem] w-full resize-none rounded-xl border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-50'

const PRIORITY_TEXT: Record<TicketPriority, string> = {
  emergency: 'font-semibold text-emergency',
  urgent: 'font-semibold text-urgent',
  standard: 'font-semibold text-standard',
}

interface TicketMetaSelectProps {
  status: TicketStatus
  priority: TicketPriority
  insuranceDamage: boolean
  situation: string
  archived?: boolean
  disabled?: boolean
  onStatusChange: (status: TicketStatus) => void
  onPriorityChange: (priority: TicketPriority) => void
  onInsuranceChange: (value: boolean) => void
  onSituationChange: (value: string) => void
  onSituationBlur: () => void
  onArchive?: () => void
  onDelete?: () => void
}

export function TicketMetaSelect({
  status,
  priority,
  insuranceDamage,
  situation,
  archived = false,
  disabled = false,
  onStatusChange,
  onPriorityChange,
  onInsuranceChange,
  onSituationChange,
  onSituationBlur,
  onArchive,
  onDelete,
}: TicketMetaSelectProps) {
  const statusOptions = TICKET_STATUSES.includes(status)
    ? TICKET_STATUSES
    : [status, ...TICKET_STATUSES]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium text-neutral-400">Dringlichkeit</span>
        <NeonSelect
          value={priority}
          disabled={disabled}
          fieldClass={FIELD_CLASS}
          selectedClass={PRIORITY_TEXT[priority]}
          onChange={(next) => onPriorityChange(next as TicketPriority)}
          options={TICKET_PRIORITIES.map((entry) => ({
            value: entry,
            label: PRIORITY_LABELS[entry],
          }))}
        />
      </div>

      <InsuranceFields
        compact
        insuranceDamage={insuranceDamage}
        disabled={disabled}
        onInsuranceChange={onInsuranceChange}
      />

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-medium text-neutral-400">Status</span>
          <NeonSelect
            value={status}
            disabled={disabled}
            fieldClass={FIELD_CLASS}
            onChange={(next) => onStatusChange(next as TicketStatus)}
            options={statusOptions.map((entry) => ({
              value: entry,
              label: STATUS_LABELS[entry] ?? entry,
            }))}
          />
        </div>

        {onArchive && !archived ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onArchive}
            className="h-11 w-[5.75rem] shrink-0 rounded-xl border border-archive/50 bg-archive/10 px-1 text-[11px] font-semibold leading-tight text-archive transition hover:bg-archive/20 disabled:opacity-40"
          >
            Abschließen
          </button>
        ) : null}

        {onDelete && archived ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            className="h-11 w-[5.75rem] shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 px-1 text-[11px] font-semibold leading-tight text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
          >
            Löschen
          </button>
        ) : null}
      </div>

      <label className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium text-neutral-400">Situation</span>
        <textarea
          value={situation}
          disabled={disabled}
          rows={3}
          placeholder="Kurz der Stand vor Ort, ohne den Chat zu durchsuchen."
          onChange={(event) => onSituationChange(event.target.value)}
          onBlur={onSituationBlur}
          className={SITUATION_CLASS}
        />
      </label>
    </div>
  )
}
