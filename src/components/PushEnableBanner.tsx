import { useEffect, useState } from 'react'
import { subscribePushForUser } from '../lib/push'
import { requestNotifyPermission } from '../lib/unread'
import type { User } from '../types'

type PushStatus = {
  hasPrivateKey: boolean
  table: 'ok' | 'missing' | 'error'
  saved: number
}

function isStandalonePwa() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function notificationState(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined' || !('PushManager' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

function germanError(error: unknown) {
  const text = error instanceof Error ? error.message : ''
  if (/pattern/i.test(text)) {
    return 'iPhone-Antwort war ungültig. App vom Home-Bildschirm öffnen und den Test bei geöffneter App wiederholen.'
  }
  return text || 'Test fehlgeschlagen.'
}

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text) as {
      ok?: boolean
      error?: string
      hasPrivateKey?: boolean
      table?: PushStatus['table']
      saved?: number
    }
  } catch {
    throw new Error(
      text.trim().startsWith('<')
        ? `Server ${response.status}: keine JSON-Antwort.`
        : `Server ${response.status}: ${text.slice(0, 120) || 'leere Antwort'}`,
    )
  }
}

export function PushEnableBanner({ currentUser }: { currentUser: User }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'default',
  )
  const [standalone, setStandalone] = useState(true)
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setStandalone(isStandalonePwa())
    setPermission(notificationState())
    void loadStatus()
  }, [currentUser.id])

  async function loadStatus() {
    try {
      const response = await fetch(`/api/push-status?userId=${encodeURIComponent(currentUser.id)}`)
      const payload = await readJson(response)
      setStatus({
        hasPrivateKey: Boolean(payload.hasPrivateKey),
        table: payload.table === 'missing' || payload.table === 'error' ? payload.table : 'ok',
        saved: payload.saved ?? 0,
      })
    } catch {
      setStatus(null)
    }
  }

  async function enable() {
    setBusy(true)
    setHint(null)
    try {
      const granted = await requestNotifyPermission()
      setPermission(notificationState())
      if (!granted) {
        setHint('Bitte im Dialog auf Erlauben tippen.')
        return
      }
      const result = await subscribePushForUser(currentUser.id)
      setHint(result.error)
      await loadStatus()
    } finally {
      setBusy(false)
    }
  }

  async function testRing() {
    setBusy(true)
    setHint(null)
    try {
      const subscribed = await subscribePushForUser(currentUser.id)
      if (!subscribed.ok) {
        setHint(subscribed.error)
        return
      }
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, userId: currentUser.id }),
      })
      const payload = await readJson(response)
      setHint(
        payload.ok
          ? 'Test gesendet. App offen lassen — Ton oder Mitteilung sollte jetzt kommen.'
          : payload.error || `Test fehlgeschlagen (${response.status}).`,
      )
      await loadStatus()
    } catch (error) {
      setHint(germanError(error))
    } finally {
      setBusy(false)
    }
  }

  const ready =
    permission === 'granted' &&
    status?.table === 'ok' &&
    status.saved > 0 &&
    status.hasPrivateKey
  if (permission === 'unsupported') return null

  return (
    <div className="mx-4 mb-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-neutral-200">
      {!standalone ? (
        <p>
          Für Klingeln bei geschlossener App: Teilen →{' '}
          <span className="font-medium text-white">Zum Home-Bildschirm</span>, App von
          dort öffnen.
        </p>
      ) : null}

      {status && !status.hasPrivateKey ? (
        <p className="mt-1 text-red-300">
          Auf Vercel fehlt VAPID_PRIVATE_KEY. Ohne den Schlüssel kommt kein Ton.
        </p>
      ) : null}

      {status?.table === 'missing' ? (
        <p className="mt-1 text-red-300">
          In Supabase fehlt die Tabelle push_subscriptions. SQL ausführen.
        </p>
      ) : null}

      {permission === 'denied' ? (
        <p className="mt-1">
          Mitteilungen sind blockiert. iPhone-Einstellungen → Kithan → Mitteilungen
          einschalten.
        </p>
      ) : permission !== 'granted' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="mt-1 font-medium text-primary"
        >
          {busy ? 'Wird eingeschaltet…' : 'Mitteilungen einschalten'}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void testRing()}
          className="mt-1 font-medium text-primary"
        >
          {busy ? 'Test läuft… App offen lassen' : ready ? 'Test-Klingel senden' : 'Mitteilungen speichern und testen'}
        </button>
      )}

      {hint ? <p className="mt-1 text-[12px] text-neutral-300">{hint}</p> : null}
    </div>
  )
}
