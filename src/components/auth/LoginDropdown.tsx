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

export async function resolveStoredUser(): Promise<User | null> {
  const stored = readStoredUser()
  if (!stored) return null

  const { data } = await supabase
    .from('users')
    .select('id, name, created_at')
    .eq('id', stored.id)
    .maybeSingle()

  if (data) {
    persistUser(data)
    return data
  }

  const { data: byName } = await supabase
    .from('users')
    .select('id, name, created_at')
    .ilike('name', stored.name.trim())
    .maybeSingle()

  if (byName) {
    persistUser(byName)
    return byName
  }

  clearStoredUser()
  return null
}

export function LoginDropdown({ onSelect }: LoginDropdownProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUsersFromApi() {
      const response = await fetch('/api/mitarbeiter')
      const payload = (await response.json()) as {
        ok?: boolean
        users?: User[]
        error?: string
      }
      if (!response.ok || !payload.ok || !payload.users) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }
      return payload.users
    }

    async function loadUsers() {
      setLoading(true)
      setError(null)
      setErrorDetail(null)

      const { data, error: queryError } = await supabase
        .from('users')
        .select('id, name, created_at')
        .order('name', { ascending: true })

      if (cancelled) return

      if (!queryError) {
        setUsers(data ?? [])
        setLoading(false)
        return
      }

      try {
        const fallbackUsers = await loadUsersFromApi()
        if (cancelled) return
        setUsers(fallbackUsers)
        setLoading(false)
      } catch (fallbackError) {
        if (cancelled) return
        setError('Mitarbeiter konnten nicht geladen werden.')
        setErrorDetail(
          [queryError.message, fallbackError instanceof Error ? fallbackError.message : '']
            .filter(Boolean)
            .join(' · '),
        )
        setLoading(false)
      }
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
    <div className="flex min-h-svh w-full items-center justify-center bg-black px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-white">
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
          <p className="mt-3 text-xs leading-relaxed text-neutral-500">
            Zum Home-Bildschirm: auf dem iPhone Teilen → „Zum Home-Bildschirm“.
            Auf Android: Menü → „App installieren“.
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
            {errorDetail ? (
              <span className="mt-1 block font-mono text-xs text-red-200/80">
                {errorDetail}
              </span>
            ) : null}
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
