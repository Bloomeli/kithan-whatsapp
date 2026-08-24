import { supabase } from './supabase'

/** Öffentlicher VAPID-Schlüssel (kein Geheimnis). */
export const VAPID_PUBLIC_KEY =
  'BEYYSKlDulxCeF-UJgpJlwUwtvOfNkF2yBE4TnYK81whhBpIJDNRMvMj_JU54YjL8YdgL3CWe3uKSNzjm0YNEqs'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }
  return output
}

export async function subscribePushForUser(
  userId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Dieses Gerät unterstützt keine Mitteilungen.' }
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return { ok: false, error: 'Mitteilungen sind nicht erlaubt.' }
  }

  const registration = await navigator.serviceWorker.ready
  try {
    await registration.update()
  } catch {
    // Alte Home-Screen-App kann das Update überspringen
  }
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const payload = subscription.toJSON()
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    return { ok: false, error: 'Das iPhone hat kein Push-Abo erzeugt.' }
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    return {
      ok: false,
      error: error.message.includes('does not exist')
        ? 'Tabelle push_subscriptions fehlt. SQL in Supabase ausführen.'
        : `Abo konnte nicht gespeichert werden. ${error.message}`,
    }
  }

  return { ok: true, error: null }
}

export async function notifyTicketMembers(input: {
  ticketId: string
  senderId: string
  title: string
  body: string
}): Promise<void> {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        url: `/#ticket/${input.ticketId}`,
      }),
    })
  } catch {
    // In-App-Hinweis bleibt als Fallback
  }
}
