import { useState, type FormEvent } from 'react'
import { NeonSelect } from '../ui/NeonSelect'
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../lib/labels'
import { getObjektLabel, OBJEKTE } from '../../lib/objekte'
import { isoToDateInput, isoToTimeInput, updateTicketDetails } from '../../lib/tickets'
import type { Ticket, TicketPriority, TicketStatus } from '../../types'
import { InsuranceFields } from '../tickets/InsuranceFields'

interface EditTicketModalProps {
  ticket: Ticket
  onClose: () => void
  onSaved: (ticket: Ticket) => void
}

const FIELD_CLASS =
  'h-12 w-full appearance-none rounded-xl border border-neutral-800 bg-black px-4 text-base text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-50'

export function EditTicketModal({ ticket, onClose, onSaved }: EditTicketModalProps) {
  const [title, setTitle] = useState(ticket.title)
  const [priority, setPriority] = useState<TicketPriority | ''>(ticket.priority)
  const [status, setStatus] = useState<TicketStatus>(ticket.status[0] ?? 'open')
  const [buildingId, setBuildingId] = useState(ticket.building_id ?? '')
  const [unitLocation, setUnitLocation] = useState(ticket.unit_location ?? '')
  const [tenantName, setTenantName] = useState(ticket.tenant_name ?? '')
  const [contact, setContact] = useState(ticket.contact ?? '')
  const [occurredDate, setOccurredDate] = useState(isoToDateInput(ticket.occurred_at))
  const [occurredTime, setOccurredTime] = useState(isoToTimeInput(ticket.occurred_at))
  const [reportedBy, setReportedBy] = useState(ticket.reported_by ?? '')
  const [insuranceDamage, setInsuranceDamage] = useState(Boolean(ticket.insurance_damage))
  const [situation, setSituation] = useState(ticket.situation ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave =
    Boolean(title.trim()) &&
    Boolean(priority) &&
    Boolean(buildingId) &&
    Boolean(occurredDate) &&
    Boolean(occurredTime) &&
    (!insuranceDamage || Boolean(situation.trim()))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !priority || !buildingId || !occurredDate || !occurredTime) return

    const occurredAt = new Date(`${occurredDate}T${occurredTime}`)
    if (Number.isNaN(occurredAt.getTime())) {
      setError('Bitte Datum und Uhrzeit prüfen.')
      return
    }

    setSaving(true)
    setError(null)

    const { ticket: next, error: saveError } = await updateTicketDetails({
      ticketId: ticket.id,
      title,
      priority,
      status,
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

    if (saveError || !next) {
      setError(saveError ?? 'Änderungen konnten nicht gespeichert werden.')
      return
    }

    onSaved(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        role="dialog"
        aria-labelledby="edit-ticket-title"
        className="flex max-h-[90svh] w-full max-w-sm flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="edit-ticket-title" className="text-base font-semibold">
            Meldung/Problem korrigieren
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-400 hover:text-white"
          >
            Schließen
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-200">Meldung/Problem</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
              disabled={saving}
              className={FIELD_CLASS}
            />
          </label>

          <div className="mt-3 flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-200">Dringlichkeit</span>
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
            <span className="text-sm font-medium text-neutral-200">Gebäude</span>
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
              className={FIELD_CLASS}
            />
          </label>

          <label className="mt-3 flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-200">Kontakt</span>
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
              className={FIELD_CLASS}
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-neutral-200">Datum</span>
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
              <span className="text-sm font-medium text-neutral-200">Uhrzeit</span>
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
            onClick={onClose}
            disabled={saving}
            className="h-12 flex-1 rounded-xl border border-neutral-800 text-sm font-semibold text-neutral-200"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving || !canSave}
            className="h-12 flex-1 rounded-xl bg-primary text-base font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
