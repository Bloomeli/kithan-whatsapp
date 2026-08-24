import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY =
  'BEYYSKlDulxCeF-UJgpJlwUwtvOfNkF2yBE4TnYK81whhBpIJDNRMvMj_JU54YjL8YdgL3CWe3uKSNzjm0YNEqs'
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '')
  .trim()
  .replace(/^["']|["']$/g, '')
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kithan-whatsapp@vercel.app'
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

function encodeB64Url(data: Uint8Array | string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeB64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function vapidAuthorization(endpoint: string) {
  const publicRaw = decodeB64Url(VAPID_PUBLIC_KEY)
  const privateRaw = decodeB64Url(VAPID_PRIVATE_KEY)
  if (publicRaw.length !== 65 || publicRaw[0] !== 0x04 || privateRaw.length !== 32) {
    throw new Error('VAPID_PRIVATE_KEY auf Vercel ist ungültig.')
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: encodeB64Url(publicRaw.subarray(1, 33)),
      y: encodeB64Url(publicRaw.subarray(33, 65)),
      d: encodeB64Url(privateRaw),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = encodeB64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const payload = encodeB64Url(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 3600,
      sub: VAPID_SUBJECT,
    }),
  )
  const unsigned = `${header}.${payload}`
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)),
  )
  return `vapid t=${unsigned}.${encodeB64Url(signature)}, k=${VAPID_PUBLIC_KEY}`
}

async function sendPushToUsers(userIds: string[]) {
  if (!VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { sent: 0, error: 'Push ist nicht konfiguriert (VAPID_PRIVATE_KEY).' }
  }
  if (userIds.length === 0) return { sent: 0, error: null as string | null }

  const supabase = createClient(new URL(SUPABASE_URL).origin, SUPABASE_ANON_KEY)
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

  let sent = 0
  let lastError = ''
  for (const row of subscriptions) {
    try {
      const response = await fetch(row.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidAuthorization(row.endpoint),
          TTL: '120',
          Urgency: 'high',
        },
      })
      if (!response.ok && response.status !== 201) {
        if (response.status === 404 || response.status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', row.id)
        }
        lastError = `Apple-Push ${response.status}`
        continue
      }
      sent += 1
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Senden fehlgeschlagen'
    }
  }
  if (sent === 0) return { sent: 0, error: lastError || 'Push kam bei keinem Gerät an.' }
  return { sent, error: null as string | null }
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' })
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (body?.test && body?.userId) {
      const result = await sendPushToUsers([String(body.userId)])
      res.status(result.error && result.sent === 0 ? 500 : 200).json({
        ok: result.sent > 0,
        sent: result.sent,
        error: result.error,
      })
      return
    }

    const ticketId = String(body?.ticketId ?? '')
    const senderId = String(body?.senderId ?? '')
    if (!ticketId || !senderId) {
      res.status(400).json({ ok: false, error: 'ticketId und senderId fehlen.' })
      return
    }

    const supabase = createClient(new URL(SUPABASE_URL).origin, SUPABASE_ANON_KEY)
    const [{ data: members, error: memberError }, { data: ticket }] = await Promise.all([
      supabase.from('ticket_members').select('user_id').eq('ticket_id', ticketId),
      supabase.from('tickets').select('created_by').eq('id', ticketId).maybeSingle(),
    ])
    if (memberError) {
      res.status(500).json({ ok: false, error: 'Mitglieder konnten nicht geladen werden.' })
      return
    }

    const recipientIds = [
      ...new Set(
        [
          ...(members ?? []).map((row) => row.user_id as string),
          ticket?.created_by as string | undefined,
        ].filter((id): id is string => Boolean(id) && id !== senderId),
      ),
    ]
    const result = await sendPushToUsers(recipientIds)
    res.status(result.error && result.sent === 0 ? 500 : 200).json({
      ok: result.sent > 0,
      sent: result.sent,
      error: result.error,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Push ist fehlgeschlagen.',
    })
  }
}
