import { useEffect, useRef, useState } from 'react'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../lib/labels'
import {
  ARCHIVE_DELETE_AFTER_DAYS,
  deleteTicketCompletely,
  fetchTicketsForMember,
  needsArchiveDeleteReminder,
} from '../../lib/tickets'
import type { Ticket, TicketPriority, User } from '../../types'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { CreateTicketModal } from './CreateTicketModal'
import { EditTicketModal } from './EditTicketModal'

const PRIORITY_DOT: Record<TicketPriority, string> = {
  emergency: 'bg-emergency shadow-[0_0_12px_#ff1a1a]',
  urgent: 'bg-urgent shadow-[0_0_12px_#ff5f1f]',
  standard: 'bg-standard shadow-[0_0_12px_#ffe500]',
}

const PRIORITY_BAR: Record<TicketPriority, string> = {
  emergency: 'bg-emergency',
  urgent: 'bg-urgent',
  standard: 'bg-standard',
}

interface TicketListProps {
  currentUser: User
  showArchived?: boolean
  createOpen?: boolean
  onCreateOpenChange?: (open: boolean) => void
  onSelectTicket?: (ticket: Ticket) => void
  onCreatedActive?: () => void
}

export function TicketList({
  currentUser,
  showArchived = false,
  createOpen = false,
  onCreateOpenChange,
  onSelectTicket,
  onCreatedActive,
}: TicketListProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [deleting, setDeleting] = useState<Ticket | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadTickets() {
      setLoading(true)
      setError(null)

      const { tickets: nextTickets, error: queryError } =
        await fetchTicketsForMember(currentUser.id, showArchived)

      if (cancelled) return

      if (queryError) {
        setError(queryError)
        setLoading(false)
        return
      }

      setTickets(nextTickets)
      setLoading(false)
    }

    void loadTickets()

    return () => {
      cancelled = true
    }
  }, [currentUser.id, showArchived])

  function handleSelect(ticket: Ticket) {
    setSelectedId(ticket.id)
    onSelectTicket?.(ticket)
  }

  async function handleDelete() {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    const { error: deleteError } = await deleteTicketCompletely(deleting.id)
    setDeleteBusy(false)

    if (deleteError) {
      setError(deleteError)
      setDeleting(null)
      return
    }

    setTickets((current) => current.filter((ticket) => ticket.id !== deleting.id))
    setDeleting(null)
  }

  const overdueCount = tickets.filter(needsArchiveDeleteReminder).length

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-black">
      {showArchived && overdueCount > 0 ? (
        <p className="mx-4 mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
          {overdueCount === 1
            ? `Ein archivierter Problemraum liegt seit ${ARCHIVE_DELETE_AFTER_DAYS} Tagen auf dem Server. Bitte löschen.`
            : `${overdueCount} archivierte Problemräume liegen seit ${ARCHIVE_DELETE_AFTER_DAYS} Tagen auf dem Server. Bitte löschen.`}
        </p>
      ) : null}

      {loading ? <TicketListSkeleton /> : null}

      {error ? (
        <p className="m-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {!loading && !error && tickets.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-neutral-400">
          {showArchived
            ? 'Keine archivierten Problemräume.'
            : 'Keine aktiven Problemräume.'}
        </p>
      ) : null}

      {!loading && tickets.length > 0 ? (
        <ul className="flex-1 overflow-y-auto pb-6">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <TicketRow
                ticket={ticket}
                selected={ticket.id === selectedId}
                archived={showArchived}
                onSelect={handleSelect}
                onEdit={setEditing}
                onDelete={showArchived ? setDeleting : undefined}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {createOpen ? (
        <CreateTicketModal
          currentUser={currentUser}
          onClose={() => onCreateOpenChange?.(false)}
          onCreated={(ticket) => {
            onCreateOpenChange?.(false)
            onCreatedActive?.()
            handleSelect(ticket)
          }}
        />
      ) : null}

      {editing ? (
        <EditTicketModal
          ticket={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setTickets((current) =>
              current.map((ticket) => (ticket.id === next.id ? next : ticket)),
            )
            setEditing(null)
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Löschen"
          message="Wollen Sie wirklich die Datei löschen?"
          confirmLabel="Löschen"
          danger
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </section>
  )
}

function TicketRow({
  ticket,
  selected,
  archived,
  onSelect,
  onEdit,
  onDelete,
}: {
  ticket: Ticket
  selected: boolean
  archived: boolean
  onSelect: (ticket: Ticket) => void
  onEdit: (ticket: Ticket) => void
  onDelete?: (ticket: Ticket) => void
}) {
  const statusText = ticket.status
    .map((status) => STATUS_LABELS[status] ?? status)
    .join(' · ')
  const overdue = archived && needsArchiveDeleteReminder(ticket)
  const timerRef = useRef<number | null>(null)
  const longPressRef = useRef(false)

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function startPress() {
    longPressRef.current = false
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      longPressRef.current = true
      onEdit(ticket)
    }, 550)
  }

  return (
    <div
      className={`flex w-full items-stretch ${
        selected ? 'bg-neutral-900' : 'bg-black'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (!longPressRef.current) onSelect(ticket)
        }}
        onPointerDown={startPress}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onPointerLeave={clearTimer}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={`${ticket.title}, ${PRIORITY_LABELS[ticket.priority]}, ${statusText}. Lange drücken zum Korrigieren.`}
        className="flex min-w-0 flex-1 items-stretch text-left transition select-none active:bg-neutral-900"
      >
        <span
          aria-hidden
          className={`w-1.5 shrink-0 ${
            archived ? 'bg-archive shadow-[0_0_10px_#aff903]' : PRIORITY_BAR[ticket.priority]
          }`}
        />
        <span className="flex min-w-0 flex-1 items-center gap-3 border-b border-neutral-800 px-3 py-3.5 pr-3">
          <span
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 rounded-full ${
              archived
                ? 'bg-archive shadow-[0_0_12px_#aff903]'
                : PRIORITY_DOT[ticket.priority]
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-white">
              {ticket.title}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-neutral-400">
              {statusText || 'Kein Status'}
            </span>
            {overdue ? (
              <span className="mt-0.5 block text-[12px] font-medium text-yellow-300">
                Bitte löschen
              </span>
            ) : null}
          </span>
          <time
            dateTime={ticket.updated_at}
            className="shrink-0 text-[11px] text-neutral-500"
          >
            {formatListTime(ticket.updated_at)}
          </time>
        </span>
      </button>
      {onDelete ? (
        <div className="flex items-center border-b border-neutral-800 pr-6">
          <button
            type="button"
            onClick={() => onDelete(ticket)}
            className="h-11 w-[4.5rem] rounded-xl border border-red-500/40 bg-red-500/10 px-1 text-[11px] font-semibold text-red-300"
          >
            Löschen
          </button>
        </div>
      ) : null}
    </div>
  )
}

function TicketListSkeleton() {
  return (
    <ul className="flex-1" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <li
          key={index}
          className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3.5"
        >
          <span className="h-3 w-3 shrink-0 rounded-full bg-neutral-800" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-2/3 rounded bg-neutral-800" />
            <span className="h-3 w-1/3 rounded bg-neutral-900" />
          </span>
        </li>
      ))}
    </ul>
  )
}

function formatListTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()

  if (sameDay) {
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })
}
