import { TICKET_STATUSES, STATUS_LABELS } from '../../lib/labels'
import type { TicketStatus } from '../../types'

interface StatusMultiSelectProps {
  value: TicketStatus[]
  onChange: (status: TicketStatus[]) => void
  disabled?: boolean
}

export function StatusMultiSelect({
  value,
  onChange,
  disabled = false,
}: StatusMultiSelectProps) {
  const selected = new Set(value)

  function toggle(status: TicketStatus) {
    if (disabled) return
    const next = selected.has(status)
      ? value.filter((entry) => entry !== status)
      : [...value, status]
    if (next.length === 0) return
    onChange(next)
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {TICKET_STATUSES.map((status) => {
        const active = selected.has(status)
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => toggle(status)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              active
                ? 'bg-primary text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            } disabled:opacity-50`}
          >
            {STATUS_LABELS[status]}
          </button>
        )
      })}
    </div>
  )
}
