import { NeonSelect } from '../ui/NeonSelect'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../lib/labels'
import type { TicketPriority, TicketStatus } from '../../types'

const FIELD_CLASS =
  'h-11 w-full appearance-none rounded-xl border border-neutral-800 bg-black px-3 text-sm text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-50'

interface TicketMetaSelectProps {
  status: TicketStatus
  priority: TicketPriority
  archived?: boolean
  disabled?: boolean
  onStatusChange: (status: TicketStatus) => void
  onPriorityChange: (priority: TicketPriority) => void
  onArchive?: () => void
  onDelete?: () => void
}

export function TicketMetaSelect({
  status,
  priority,
  archived = false,
  disabled = false,
  onStatusChange,
  onPriorityChange,
  onArchive,
  onDelete,
}: TicketMetaSelectProps) {
  const statusOptions = TICKET_STATUSES.includes(status)
    ? TICKET_STATUSES
    : [status, ...TICKET_STATUSES]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-neutral-400">Dringlichkeit</span>
        <NeonSelect
          value={priority}
          disabled={disabled}
          fieldClass={FIELD_CLASS}
          onChange={(next) => onPriorityChange(next as TicketPriority)}
          options={TICKET_PRIORITIES.map((entry) => ({
            value: entry,
            label: PRIORITY_LABELS[entry],
          }))}
        />
      </div>

      <div className="flex flex-col gap-1">
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
        <div className="flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={onArchive}
            className="h-11 w-1/4 rounded-xl border border-archive/50 bg-archive/10 px-1 text-[11px] font-semibold leading-tight text-archive transition hover:bg-archive/20 disabled:opacity-40"
          >
            Abschließen
          </button>
        </div>
      ) : null}

      {onDelete && archived ? (
        <div className="flex justify-end pr-4">
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            className="h-11 w-1/4 rounded-xl border border-red-500/40 bg-red-500/10 px-1 text-[11px] font-semibold leading-tight text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
          >
            Löschen
          </button>
        </div>
      ) : null}
    </div>
  )
}
