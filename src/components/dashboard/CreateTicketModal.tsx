import { useState, type FormEvent } from 'react'
import { createTicketForUser } from '../../lib/tickets'
import type { Ticket, User } from '../../types'

interface CreateTicketModalProps {
  currentUser: User
  onClose: () => void
  onCreated: (ticket: Ticket) => void
}

export function CreateTicketModal({
  currentUser,
  onClose,
  onCreated,
}: CreateTicketModalProps) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    setError(null)

    const { ticket, error: createError } = await createTicketForUser(
      title,
      currentUser.id,
    )

    setSaving(false)

    if (createError || !ticket) {
      setError(createError ?? 'Problemraum konnte nicht erstellt werden.')
      return
    }

    onCreated(ticket)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        role="dialog"
        aria-labelledby="create-ticket-title"
        className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="create-ticket-title" className="text-base font-semibold">
            Neues Ticket
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-400 hover:text-white"
          >
            Schließen
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-200">Titel</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
            disabled={saving}
            placeholder="Titel des Problemraums"
            className="h-12 w-full rounded-xl border border-neutral-800 bg-black px-4 text-base text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="mt-4 h-12 w-full rounded-xl bg-primary text-base font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Wird erstellt…' : 'Erstellen'}
        </button>
      </form>
    </div>
  )
}
