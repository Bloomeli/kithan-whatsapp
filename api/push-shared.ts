import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const VAPID_PUBLIC_KEY =
  'BEYYSKlDulxCeF-UJgpJlwUwtvOfNkF2yBE4TnYK81whhBpIJDNRMvMj_JU54YjL8YdgL3CWe3uKSNzjm0YNEqs'

export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kithan-whatsapp@vercel.app'
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

export function pushConfigured() {
  return Boolean(VAPID_PRIVATE_KEY && SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function supabaseAdmin() {
  return createClient(new URL(SUPABASE_URL).origin, SUPABASE_ANON_KEY)
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; tag?: string; url?: string; unread?: number },
): Promise<{ sent: number; error: string | null }> {
  if (!pushConfigured()) {
    return { sent: 0, error: 'Push ist nicht konfiguriert (VAPID_PRIVATE_KEY).' }
  }
  if (userIds.length === 0) {
    return { sent: 0, error: null }
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const supabase = supabaseAdmin()
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (subError) {
    return {
      sent: 0,
      error: subError.message.includes('does not exist')
        ? 'Tabelle push_subscriptions fehlt. SQL in Supabase ausführen.'
        : `Push-Abos konnten nicht geladen werden. ${subError.message}`,
    }
  }

  if (!subscriptions?.length) {
    return { sent: 0, error: 'Kein Gerät angemeldet. Mitteilungen auf dem iPhone einschalten.' }
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag || 'kithan-message',
    url: payload.url || '/',
    unread: payload.unread ?? 1,
  })

  let sent = 0
  let lastError = ''
  for (const row of subscriptions) {
    try {
      await withTimeout(
        webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body,
          { TTL: 120, urgency: 'high' },
        ),
        8000,
        'Zeitüberschreitung beim Apple-Push.',
      )
      sent += 1
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Senden fehlgeschlagen'
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? Number(error.statusCode)
          : 0
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id)
      }
    }
  }

  if (sent === 0) {
    return { sent: 0, error: lastError || 'Push kam bei keinem Gerät an.' }
  }
  return { sent, error: null }
}
