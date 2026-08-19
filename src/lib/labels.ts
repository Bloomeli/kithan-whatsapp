import type { TicketStatus, TicketPriority } from '../types'

export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'waiting',
  'done',
]

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  waiting: 'Wartet',
  done: 'Erledigt',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  emergency: 'Notfall',
  urgent: 'Dringend',
  standard: 'Kann warten',
}
