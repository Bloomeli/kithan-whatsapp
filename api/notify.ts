import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BOyUH_7CAkXbczYZzgSOXl3qCy09qGplR6g8W5LgbpbLAcMNV_bNRLphOpXsuSgRYZEyQjpIUoWnF1BxqVbmzRY'

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kithan-whatsapp@vercel.app'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
    setHeader: (name: string, value: string) => void
  },
) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({
      ok: false,
      error: 'Push ist nicht konfiguriert (VAPID_PRIVATE_KEY).',
    })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const ticketId = String(body?.ticketId ?? '')
  const senderId = String(body?.senderId ?? '')
  const title = String(body?.title ?? 'Kithan')
  const text = String(body?.body ?? 'Neue Nachricht')
  const url = String(body?.url ?? '/')

  if (!ticketId || !senderId) {
    res.status(400).json({ ok: false, error: 'ticketId und senderId fehlen.' })
    return
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const { data: members, error: memberError } = await supabase
    .from('ticket_members')
    .select('user_id')
    .eq('ticket_id', ticketId)

  if (memberError) {
    res.status(500).json({ ok: false, error: 'Mitglieder konnten nicht geladen werden.' })
    return
  }

  const recipientIds = [
    ...new Set(
      (members ?? [])
        .map((row) => row.user_id as string)
        .filter((id) => id !== senderId),
    ),
  ]

  if (recipientIds.length === 0) {
    res.status(200).json({ ok: true, sent: 0 })
    return
  }

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', recipientIds)

  if (subError) {
    res.status(500).json({ ok: false, error: 'Push-Abos konnten nicht geladen werden.' })
    return
  }

  const payload = JSON.stringify({
    title,
    body: text,
    tag: ticketId,
    url,
    unread: 1,
  })

  let sent = 0
  for (const row of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
      )
      sent += 1
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? Number(error.statusCode)
          : 0
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id)
      }
    }
  }

  res.status(200).json({ ok: true, sent })
}
