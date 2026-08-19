import { supabase } from './supabase'
import type { Ticket, TicketStatus } from '../types'

const TICKET_COLUMNS =
  'id, title, remarks, priority, status, archived, created_by, created_at, updated_at'

const OPEN_STATUS: TicketStatus[] = ['open']

export async function fetchTicketsForMember(
  userId: string,
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
    .eq('archived', false)
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

export async function createTicketForUser(
  title: string,
  userId: string,
): Promise<{ ticket: Ticket | null; error: string | null }> {
  const trimmed = title.trim()
  if (!trimmed) {
    return { ticket: null, error: 'Bitte einen Titel eingeben.' }
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      title: trimmed,
      created_by: userId,
      status: OPEN_STATUS,
    })
    .select(TICKET_COLUMNS)
    .single()

  if (ticketError || !ticket) {
    return { ticket: null, error: 'Problemraum konnte nicht erstellt werden.' }
  }

  const { error: memberError } = await supabase.from('ticket_members').insert({
    ticket_id: ticket.id,
    user_id: userId,
  })

  if (memberError) {
    await supabase.from('tickets').delete().eq('id', ticket.id)
    return {
      ticket: null,
      error: 'Problemraum konnte nicht mit deinem Konto verknüpft werden.',
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
