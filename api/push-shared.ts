import { createClient } from '@supabase/supabase-js'

export const VAPID_PUBLIC_KEY =
  'BEYYSKlDulxCeF-UJgpJlwUwtvOfNkF2yBE4TnYK81whhBpIJDNRMvMj_JU54YjL8YdgL3CWe3uKSNzjm0YNEqs'

export const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '')
  .trim()
  .replace(/^["']|["']$/g, '')
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

async function sendApplePush(endpoint: string) {
  const authorization = await vapidAuthorization(endpoint)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      TTL: '120',
      Urgency: 'high',
    },
  })
  if (!response.ok && response.status !== 201) {
    const text = await response.text()
    const error = new Error(`Apple-Push ${response.status}: ${text.slice(0, 160)}`)
    Object.assign(error, { statusCode: response.status })
    throw error
  }
}

export async function sendPushToUsers(
  userIds: string[],
): Promise<{ sent: number; error: string | null }> {
  if (!pushConfigured()) {
    return { sent: 0, error: 'Push ist nicht konfiguriert (VAPID_PRIVATE_KEY).' }
  }
  if (userIds.length === 0) {
    return { sent: 0, error: null }
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (error) {
    return {
      sent: 0,
      error: `Supabase-URL ungültig. ${error instanceof Error ? error.message : ''}`.trim(),
    }
  }

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
      await sendApplePush(row.endpoint)
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
