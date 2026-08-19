import { supabase } from './supabase'
import type { Ticket, TicketPriority, TicketStatus } from '../types'

const TICKET_COLUMNS =
  'id, title, remarks, priority, status, archived, created_by, created_at, updated_at, building_id, building_label, unit_location, tenant_name, occurred_at, reported_by'

export async function fetchTicketsForMember(
  userId: string,
  archived = false,
): Promise<{ tickets: Ticket[]; error: string | null }> {
  const { data: memberships, error: memberError } = await supabase
    .from('ticket_members')
    .select('ticket_id')
    .eq('user_id', userId)

  if (memberError) {
    return { tickets: [], error: 'Problemräume konnten nicht geladen werden.' }
  }

  const ticketIds = [
    ...new Set((memberships ?? []).map((row) => row.ticket_id)),
  ]

  if (ticketIds.length === 0) {
    return { tickets: [], error: null }
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
  const { data: membership, error: memberError } = await supabase
    .from('ticket_members')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) return null

  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_COLUMNS)
    .eq('id', ticketId)
    .maybeSingle()

  if (error || !data) return null
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
    })
    .select(TICKET_COLUMNS)
    .single()

  if (ticketError || !ticket) {
    return { ticket: null, error: 'Problemraum konnte nicht erstellt werden.' }
  }

  const uniqueMemberIds = [...new Set([input.userId, ...input.memberIds])]
  const { error: memberError } = await supabase.from('ticket_members').insert(
    uniqueMemberIds.map((userId) => ({
      ticket_id: ticket.id,
      user_id: userId,
    })),
  )

  if (memberError) {
    await supabase.from('tickets').delete().eq('id', ticket.id)
    return {
      ticket: null,
      error: 'Problemraum konnte nicht mit den Mitgliedern verknüpft werden.',
    }
  }

  return { ticket, error: null }
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
