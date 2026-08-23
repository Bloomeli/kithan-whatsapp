import { supabase } from './supabase'
import type { Message, TicketMember } from '../types'

export type ReceiptStatus = 'sent' | 'delivered' | 'read'

export function messageReceipt(
  message: Message,
  currentUserId: string,
  members: TicketMember[],
): ReceiptStatus {
  const others = members.filter((member) => member.user_id !== currentUserId)
  if (others.length === 0) return 'sent'
  const someoneRead = others.some(
    (member) =>
      Boolean(member.last_read_at) &&
      (member.last_read_at as string) >= message.created_at,
  )
  if (someoneRead) return 'read'
  return 'delivered'
}

export function formatUnreadBadge(count: number): string | null {
  if (count <= 0) return null
  if (count > 9) return '9+'
  return String(count)
}

export function totalUnread(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

export async function fetchUnreadCounts(
  userId: string,
): Promise<Record<string, number>> {
  const { data: memberships, error: memberError } = await supabase
    .from('ticket_members')
    .select('ticket_id, last_read_at')
    .eq('user_id', userId)

  if (memberError || !memberships?.length) return {}

  const ticketIds = memberships.map((row) => row.ticket_id)
  const { data: messages, error: messageError } = await supabase
    .from('messages')
    .select('ticket_id, created_at')
    .in('ticket_id', ticketIds)
    .neq('user_id', userId)

  if (messageError || !messages) return {}

  const lastReadByTicket = new Map(
    memberships.map((row) => [row.ticket_id, row.last_read_at ?? '']),
  )
  const counts: Record<string, number> = {}

  for (const message of messages) {
    const lastRead = lastReadByTicket.get(message.ticket_id) ?? ''
    if (message.created_at > lastRead) {
      counts[message.ticket_id] = (counts[message.ticket_id] ?? 0) + 1
    }
  }

  return counts
}

export async function markTicketRead(
  ticketId: string,
  userId: string,
): Promise<void> {
  await supabase
    .from('ticket_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('ticket_id', ticketId)
    .eq('user_id', userId)
}

export async function setHomeScreenBadge(count: number): Promise<void> {
  if (!('setAppBadge' in navigator)) return
  try {
    if (count > 0) {
      await navigator.setAppBadge(count)
    } else {
      await navigator.clearAppBadge()
    }
  } catch {
    // iOS ohne Badge-API oder ohne Home-Screen-App
  }
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function showSystemNotification(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      tag,
      silent: false,
    })
  } catch {
    // PWA ohne Notification-Support
  }
}

let audioContext: AudioContext | null = null

export function unlockNotifyAudio() {
  const Context = window.AudioContext || window.webkitAudioContext
  if (!Context) return
  if (!audioContext) audioContext = new Context()
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
}

export function playNotifySound() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  unlockNotifyAudio()
  if (!audioContext || audioContext.state !== 'running') return

  const now = audioContext.currentTime
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, now)
  oscillator.frequency.setValueAtTime(1175, now + 0.11)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.34)
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
