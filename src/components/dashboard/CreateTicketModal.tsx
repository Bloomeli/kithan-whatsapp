import { useEffect, useState, type FormEvent } from 'react'
import { NeonSelect } from '../ui/NeonSelect'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../lib/labels'
import { getObjektLabel, OBJEKTE } from '../../lib/objekte'
import { supabase } from '../../lib/supabase'
import { createTicketForUser } from '../../lib/tickets'
import type { Ticket, TicketPriority, TicketStatus, User } from '../../types'
import { InsuranceFields } from '../tickets/InsuranceFields'

interface CreateTicketModalProps {
  currentUser: User
  onClose: () => void
  onCreated: (ticket: Ticket) => void
}

const FIELD_CLASS =
  'h-12 w-full appearance-none rounded-xl border border-neutral-800 bg-black px-4 text-base text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-50'

export function CreateTicketModal({
  currentUser,
  onClose,
  onCreated,
}: CreateTicketModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [users, setUsers] = useState<User[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TicketPriority | ''>('')
  const [status, setStatus] = useState<TicketStatus>('open')
  const [buildingId, setBuildingId] = useState('')
  const [unitLocation, setUnitLocation] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [contact, setContact] = useState('')
  const [occurredDate, setOccurredDate] = useState('')
  const [occurredTime, setOccurredTime] = useState('')
  const [reportedBy, setReportedBy] = useState('')
  const [insuranceDamage, setInsuranceDamage] = useState(false)
  const [situation, setSituation] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setLoadingUsers(false)
        return
      }
      setUsers((data ?? []).filter((user) => user.id !== currentUser.id))
      setLoadingUsers(false)
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [currentUser.id])

  function toggleMember(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !priority || !buildingId || !occurredDate || !occurredTime) {
      return
    }

    const occurredAt = new Date(`${occurredDate}T${occurredTime}`)
    if (Number.isNaN(occurredAt.getTime())) {
      setError('Bitte Datum und Uhrzeit prüfen.')
      return
    }

    setSaving(true)
    setError(null)

    const { ticket, error: createError } = await createTicketForUser({
      title,
      userId: currentUser.id,
      priority,
      status,
      memberIds: selectedIds,
      buildingId,
      buildingLabel: getObjektLabel(buildingId),
      unitLocation,
      tenantName,
      occurredAt: occurredAt.toISOString(),
      reportedBy,
      insuranceDamage,
      situation,
      contact,
    })

    setSaving(false)

    if (createError || !ticket) {
      setError(createError ?? 'Problemraum konnte nicht erstellt werden.')
      return
    }

    onCreated(ticket)
  }

  const canCreate =
    Boolean(title.trim()) &&
    Boolean(priority) &&
    Boolean(buildingId) &&
    Boolean(occurredDate) &&
    Boolean(occurredTime) &&
    (!insuranceDamage || Boolean(situation.trim()))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        role="dialog"
        aria-labelledby="create-ticket-title"
        className="flex max-h-[90svh] w-full max-w-sm flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="create-ticket-title" className="text-base font-semibold">
            {step === 1 ? 'Zuständige Personen' : 'Neue Meldung/Problem'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-400 hover:text-white"
          >
            Schließen
          </button>
        </div>

        <p className="mb-3 text-xs text-neutral-500">Schritt {step} von 2</p>

        {step === 1 ? (
          <>
            <p className="mb-2 text-sm text-neutral-300">
              Du bist automatisch dabei. Weitere Kollegen auswählen, dann weiter.
            </p>
            {error ? (
              <p className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            {loadingUsers ? (
              <p className="py-6 text-center text-sm text-neutral-400">
                Lade Liste…
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {users.map((user) => {
                  const checked = selectedIds.includes(user.id)
                  return (
                    <li
                      key={user.id}
                      className="border-b border-neutral-800 last:border-b-0"
                    >
                      <label className="flex w-full cursor-pointer items-center justify-between gap-3 px-1 py-3">
                        <span className="text-sm font-medium">{user.name}</span>
                        <span
                          aria-hidden
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-primary bg-transparent"
                        >
                          {checked ? <CheckIcon /> : null}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(user.id)}
                          className="sr-only"
                        />
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={() => {
                setError(null)
                setStep(2)
              }}
              className="mt-4 h-12 w-full rounded-xl bg-primary text-base font-semibold text-white transition hover:bg-primary/90"
            >
              Weiter
            </button>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-200">
                  Meldung/Problem
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  autoFocus
                  disabled={saving}
                  placeholder="z. B. Wasserschaden Küche"
                  className={FIELD_CLASS}
                />
              </label>

              <div className="mt-3 flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-200">
                  Dringlichkeit
                </span>
                <NeonSelect
                  value={priority}
                  disabled={saving}
                  fieldClass={FIELD_CLASS}
                  placeholder="Bitte wählen"
                  onChange={(next) => setPriority(next as TicketPriority)}
                  options={TICKET_PRIORITIES.map((entry) => ({
                    value: entry,
                    label: PRIORITY_LABELS[entry],
                  }))}
                />
              </div>

              <div className="mt-3">
                <InsuranceFields
                  insuranceDamage={insuranceDamage}
                  situation={situation}
                  disabled={saving}
                  onInsuranceChange={setInsuranceDamage}
                  onSituationChange={setSituation}
                />
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-200">Status</span>
                <NeonSelect
                  value={status}
                  disabled={saving}
                  fieldClass={FIELD_CLASS}
                  onChange={(next) => setStatus(next as TicketStatus)}
                  options={TICKET_STATUSES.map((entry) => ({
                    value: entry,
                    label: STATUS_LABELS[entry],
                  }))}
                />
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-200">
                  Gebäude
                </span>
                <NeonSelect
                  value={buildingId}
                  disabled={saving}
                  fieldClass={FIELD_CLASS}
                  placeholder="Bitte Gebäude wählen..."
                  onChange={setBuildingId}
                  options={OBJEKTE.map((objekt) => ({
                    value: objekt.id,
                    label: objekt.label,
                  }))}
                />
              </div>

              <label className="mt-3 flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-200">
                  Bereich/Stockwerk/Mietfläche
                </span>
                <input
                  type="text"
                  value={unitLocation}
                  onChange={(event) => setUnitLocation(event.target.value)}
                  disabled={saving}
                  placeholder="z.B. EG links, 2. OG, Mietfläche 07"
                  className={FIELD_CLASS}
                />
              </label>

              <label className="mt-3 flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-200">
                  Betroffener Mieter
                </span>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(event) => setTenantName(event.target.value)}
                  disabled={saving}
                  placeholder="Name"
                  className={FIELD_CLASS}
                />
              </label>

              <label className="mt-3 flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-200">
                  Kontakt
                </span>
                <input
                  type="text"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  disabled={saving}
                  placeholder="Telefon oder E-Mail"
                  className={FIELD_CLASS}
                />
              </label>

              <label className="mt-3 flex flex-col gap-2">
                <span className="text-sm font-medium text-neutral-200">
                  Wer hat das Problem gemeldet?
                </span>
                <input
                  type="text"
                  value={reportedBy}
                  onChange={(event) => setReportedBy(event.target.value)}
                  disabled={saving}
                  placeholder="Name"
                  className={FIELD_CLASS}
                />
              </label>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-neutral-200">
                    Datum
                  </span>
                  <input
                    type="date"
                    value={occurredDate}
                    onChange={(event) => setOccurredDate(event.target.value)}
                    required
                    disabled={saving}
                    className={FIELD_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-neutral-200">
                    Uhrzeit
                  </span>
                  <input
                    type="time"
                    value={occurredTime}
                    onChange={(event) => setOccurredTime(event.target.value)}
                    required
                    disabled={saving}
                    className={FIELD_CLASS}
                  />
                </label>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={saving}
                className="h-12 flex-1 rounded-xl border border-neutral-800 text-sm font-semibold text-neutral-200"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={saving || !canCreate}
                className="h-12 flex-1 rounded-xl bg-primary text-base font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Wird erstellt…' : 'Erstellen'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-primary" fill="none" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
