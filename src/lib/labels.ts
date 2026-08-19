import type { TicketStatus, TicketPriority } from '../types'

/** 7 Arbeits-Status. Archiv ist kein Enum-Wert, sondern tickets.archived. */
export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'under_review',
  'in_progress',
  'needs_consultation',
  'waiting_for_tenant',
  'waiting_for_parts',
  'done',
]

export const TICKET_PRIORITIES: TicketPriority[] = [
  'emergency',
  'urgent',
  'standard',
]

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Offen',
  under_review: 'Wird geprüft',
  in_progress: 'In Bearbeitung',
  needs_consultation: 'Benötige Rücksprache',
  waiting: 'Wartet',
  waiting_for_tenant: 'Warten auf Mieter',
  waiting_for_parts: 'Warten auf Teile',
  done: 'Wird erledigt',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  emergency: 'Notfall / Alarm',
  urgent: 'Dringend',
  standard: 'Kann warten',
}
