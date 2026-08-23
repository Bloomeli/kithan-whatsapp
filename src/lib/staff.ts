import { supabase } from './supabase'
import type { User } from '../types'

export const STAFF_NAMES = [
  'Arsim',
  'Besatim',
  'Blerim',
  'Fatmir',
  'Halim',
  'Jonas',
  'Lubig',
  'Nives',
  'Philip',
  'Sascha',
  'Nextel',
  'Rita',
  'Bercem',
] as const

export const INSURANCE_HANDLER_NAMES = ['Rita', 'Bercem'] as const

export async function getInsuranceHandlerUsers(): Promise<User[]> {
  const { data: users } = await supabase.from('users').select('id, name, created_at')
  const wanted = new Set(INSURANCE_HANDLER_NAMES.map((name) => name.toLowerCase()))
  return (users ?? []).filter((user) => wanted.has(user.name.trim().toLowerCase()))
}

export async function addInsuranceHandlers(ticketId: string): Promise<User[]> {
  const handlers = await getInsuranceHandlerUsers()
  if (handlers.length === 0) return []

  await supabase.from('ticket_members').upsert(
    handlers.map((user) => ({ ticket_id: ticketId, user_id: user.id })),
    { onConflict: 'ticket_id,user_id', ignoreDuplicates: true },
  )

  return handlers
}
