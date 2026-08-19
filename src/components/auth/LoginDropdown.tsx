import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import {
  CURRENT_USER_STORAGE_KEY,
  type User,
} from '../../types'

interface LoginDropdownProps {
  onSelect: (user: User) => void
}

export function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as User
    if (!parsed?.id || !parsed?.name) return null
    return parsed
  } catch {
    return null
  }
}

export function persistUser(user: User) {
  localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user))
}

export function clearStoredUser() {
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
}

export function LoginDropdown({ onSelect }: LoginDropdownProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      setLoading(true)
      setError(null)

      const { data, error: queryError } = await supabase
        .from('users')
        .select('id, name, created_at')
        .order('name', { ascending: true })

      if (cancelled) return

      if (queryError) {
        setError(
          'Mitarbeiter konnten nicht geladen werden. Prüfe die Supabase-Verbindung und ob das Schema ausgeführt wurde.',
        )
        setLoading(false)
        return
      }

      setUsers(data ?? [])
      setLoading(false)
    }

    void loadUsers()

    return () => {
      cancelled = true
    }
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const user = users.find((entry) => entry.id === selectedId)
    if (!user) return
    persistUser(user)
    onSelect(user)
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-black px-4 py-8 text-white">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-6"
      >
        <header className="text-center">
          <p className="mb-2 text-xs font-semibold tracking-[0.28em] text-primary uppercase">
            Kithan
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Problemräume
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Mitarbeiter auswählen, um fortzufahren.
          </p>
        </header>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-200">Name</span>
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={loading || users.length === 0}
            required
            className="h-12 w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950 px-4 text-base text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>
              {loading ? 'Lade Mitarbeiter…' : 'Bitte wählen'}
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id} className="bg-black text-white">
                {user.name}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {!loading && !error && users.length === 0 ? (
          <p className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-200">
            Keine Mitarbeiter gefunden. Lege Namen in der Supabase-Tabelle
            <span className="font-mono"> users </span>
            an.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !selectedId}
          className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anmelden
        </button>
      </form>
    </div>
  )
}
