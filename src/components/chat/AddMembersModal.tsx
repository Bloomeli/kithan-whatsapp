import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'

interface AddMembersModalProps {
  ticketId: string
  memberIds: string[]
  currentUserId: string
  onClose: () => void
  onAdded: (user: User) => void
}

export function AddMembersModal({
  ticketId,
  memberIds,
  currentUserId,
  onClose,
  onAdded,
}: AddMembersModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const memberSet = new Set(memberIds)

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      const { data, error: queryError } = await supabase
        .from('users')
        .select('id, name, created_at')
        .order('name', { ascending: true })

      if (cancelled) return
      if (queryError) {
        setError('Mitarbeiter konnten nicht geladen werden.')
        setLoading(false)
        return
      }
      setUsers((data ?? []).filter((user) => user.id !== currentUserId))
      setLoading(false)
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  async function addMember(user: User) {
    if (memberSet.has(user.id) || savingId) return
    setSavingId(user.id)
    setError(null)

    const { error: insertError } = await supabase.from('ticket_members').insert({
      ticket_id: ticketId,
      user_id: user.id,
    })

    setSavingId(null)

    if (insertError) {
      setError('Kollege konnte nicht hinzugefügt werden.')
      return
    }

    onAdded(user)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="add-members-title"
        className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="add-members-title" className="text-base font-semibold">
            Kollegen hinzufügen
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-400 hover:text-white"
          >
            Schließen
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-neutral-400">Lade Liste…</p>
        ) : null}

        {error ? (
          <p className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <ul className="max-h-72 overflow-y-auto">
          {users.map((user) => {
            const already = memberSet.has(user.id)
            return (
              <li key={user.id} className="border-b border-neutral-800 last:border-b-0">
                <button
                  type="button"
                  disabled={already || savingId === user.id}
                  onClick={() => void addMember(user)}
                  className="flex w-full items-center justify-between px-1 py-3 text-left disabled:opacity-40"
                >
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xl font-light leading-none text-primary">
                    {already ? '✓' : savingId === user.id ? '…' : '+'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
