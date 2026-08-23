import { supabase } from './supabase'
import { addInsuranceHandlers, getInsuranceHandlerUsers } from './staff'
import { CHAT_MEDIA_BUCKET, type Ticket, type TicketPriority, type TicketStatus } from '../types'

const TICKET_COLUMNS =
  'id, title, remarks, priority, status, archived, created_by, created_at, updated_at, archived_at, building_id, building_label, unit_location, tenant_name, occurred_at, reported_by, insurance_damage, situation, contact'

export const ARCHIVE_DELETE_AFTER_DAYS = 14
const ARCHIVE_DELETE_AFTER_MS = ARCHIVE_DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000

export async function ensureTicketMembership(ticketId: string, userId: string) {
  const { error } = await supabase.from('ticket_members').upsert(
    {
      ticket_id: ticketId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'ticket_id,user_id', ignoreDuplicates: true },
  )
  return !error
}

export async function fetchTicketsForMember(
  userId: string,
  archived = false,
): Promise<{ tickets: Ticket[]; error: string | null }> {
  const [{ data: memberships, error: memberError }, { data: created, error: createdError }] =
    await Promise.all([
      supabase.from('ticket_members').select('ticket_id').eq('user_id', userId),
      supabase.from('tickets').select('id').eq('created_by', userId),
    ])

  if (memberError || createdError) {
    return { tickets: [], error: 'Problemräume konnten nicht geladen werden.' }
  }

  const ticketIds = [
    ...new Set([
      ...(memberships ?? []).map((row) => row.ticket_id),
      ...(created ?? []).map((row) => row.id),
    ]),
  ]

  if (ticketIds.length === 0) {
    return { tickets: [], error: null }
  }

  for (const ticketId of created ?? []) {
    void ensureTicketMembership(ticketId.id, userId)
  }

  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .eq('archived', archived)
    .in('id', ticketIds)
    .order('updated_at', { ascending: false })

  if (error) {
    return { tickets: [], error: 'Problemräume konnten nicht geladen werden.' }
  }

  return { tickets: data ?? [], error: null }
}

export async function fetchAccessibleTicket(
  ticketId: string,
  userId: string,
): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .eq('id', ticketId)
    .maybeSingle()

  if (error || !data) return null

  const { data: membership } = await supabase
    .from('ticket_members')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership && data.created_by !== userId) return null

  await ensureTicketMembership(ticketId, userId)
  return data
}

export async function createTicketForUser(input: {
  title: string
  userId: string
  priority: TicketPriority
  status: TicketStatus
  memberIds: string[]
  buildingId: string
  buildingLabel: string
  unitLocation: string
  tenantName: string
  occurredAt: string
  reportedBy: string
  insuranceDamage?: boolean
  situation?: string
  contact?: string
  remarks?: string
}): Promise<{ ticket: Ticket | null; error: string | null }> {
  const trimmed = input.title.trim()
  if (!trimmed) {
    return { ticket: null, error: 'Bitte einen Titel eingeben.' }
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      title: trimmed,
      created_by: input.userId,
      priority: input.priority,
      status: [input.status],
      building_id: input.buildingId,
      building_label: input.buildingLabel,
      unit_location: input.unitLocation.trim() || null,
      tenant_name: input.tenantName.trim() || null,
      occurred_at: input.occurredAt,
      reported_by: input.reportedBy.trim() || null,
      insurance_damage: Boolean(input.insuranceDamage),
      situation: input.situation?.trim() || null,
      contact: input.contact?.trim() || null,
      remarks: input.remarks?.trim() || null,
    })
    .select(TICKET_COLUMNS)
    .single()

  if (ticketError || !ticket) {
    const detail = ticketError?.message ?? ''
    if (/foreign key|created_by/i.test(detail)) {
      return {
        ticket: null,
        error:
          'Die Anmeldung ist veraltet. Bitte abmelden und mit dem Vornamen neu anmelden.',
      }
    }
    return {
      ticket: null,
      error: `Problemraum konnte nicht erstellt werden. ${detail}`.trim(),
    }
  }

  const handlerIds = input.insuranceDamage
    ? (await getInsuranceHandlerUsers()).map((user) => user.id)
    : []

  const { data: knownUsers } = await supabase.from('users').select('id')
  const knownIds = new Set((knownUsers ?? []).map((user) => user.id))
  const extraIds =
    knownIds.size === 0
      ? []
      : [...input.memberIds, ...handlerIds].filter(
          (userId) => userId !== input.userId && knownIds.has(userId),
        )
  const uniqueMemberIds = [...new Set([input.userId, ...extraIds])]

  const now = new Date().toISOString()
  const { error: memberError } = await supabase.from('ticket_members').upsert(
    uniqueMemberIds.map((userId) => ({
      ticket_id: ticket.id,
      user_id: userId,
      last_read_at: now,
    })),
    { onConflict: 'ticket_id,user_id', ignoreDuplicates: true },
  )

  if (memberError) {
    if (await ensureTicketMembership(ticket.id, input.userId)) {
      return { ticket, error: null }
    }
    return {
      ticket: null,
      error: `Problemraum konnte nicht mit den Mitgliedern verknüpft werden. ${memberError.message}`.trim(),
    }
  }

  return { ticket, error: null }
}

export async function updateTicketDetails(input: {
  ticketId: string
  title: string
  priority: TicketPriority
  status: TicketStatus
  buildingId: string
  buildingLabel: string
  unitLocation: string
  tenantName: string
  occurredAt: string
  reportedBy: string
  insuranceDamage?: boolean
  situation?: string
  contact?: string
  remarks?: string
}): Promise<{ ticket: Ticket | null; error: string | null }> {
  const trimmed = input.title.trim()
  if (!trimmed) {
    return { ticket: null, error: 'Bitte einen Titel eingeben.' }
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update({
      title: trimmed,
      priority: input.priority,
      status: [input.status],
      building_id: input.buildingId,
      building_label: input.buildingLabel,
      unit_location: input.unitLocation.trim() || null,
      tenant_name: input.tenantName.trim() || null,
      occurred_at: input.occurredAt,
      reported_by: input.reportedBy.trim() || null,
      insurance_damage: Boolean(input.insuranceDamage),
      situation: input.situation?.trim() || null,
      contact: input.contact?.trim() || null,
      remarks: input.remarks?.trim() || null,
    })
    .eq('id', input.ticketId)
    .select(TICKET_COLUMNS)
    .single()

  if (error || !ticket) {
    return { ticket: null, error: 'Änderungen konnten nicht gespeichert werden.' }
  }

  if (input.insuranceDamage) {
    await addInsuranceHandlers(input.ticketId)
  }

  return { ticket, error: null }
}

export async function deleteTicketCompletely(
  ticketId: string,
): Promise<{ error: string | null }> {
  const { data: files } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .list(ticketId, { limit: 100 })

  if (files && files.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .remove(files.map((file) => `${ticketId}/${file.name}`))

    if (storageError) {
      return { error: 'Dateien auf dem Server konnten nicht gelöscht werden.' }
    }
  }

  const { error } = await supabase.from('tickets').delete().eq('id', ticketId)
  if (error) {
    return { error: 'Problemraum konnte nicht gelöscht werden.' }
  }

  return { error: null }
}

export function needsArchiveDeleteReminder(ticket: Ticket): boolean {
  if (!ticket.archived) return false
  const start = ticket.archived_at ?? ticket.updated_at
  const at = new Date(start).getTime()
  if (Number.isNaN(at)) return false
  return Date.now() - at >= ARCHIVE_DELETE_AFTER_MS
}

export function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isoToTimeInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const TICKET_HASH_PATTERN =
  /^ticket\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function parseTicketHash(hash: string): string | null {
  const value = hash.replace(/^#/, '').trim()
  const match = TICKET_HASH_PATTERN.exec(value)
  return match?.[1] ?? null
}

export function ticketHash(ticketId: string): string {
  return `#ticket/${ticketId}`
}
