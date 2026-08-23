import { useEffect, useState } from 'react'
import { subscribePushForUser } from '../lib/push'
import { requestNotifyPermission } from '../lib/unread'
import type { User } from '../types'

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

export function PushEnableBanner({ currentUser }: { currentUser: User }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'default',
  )
  const [standalone, setStandalone] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setStandalone(isStandalonePwa())
    setPermission(notificationState())
  }, [])

  if (permission === 'granted' || permission === 'unsupported') return null

  async function enable() {
    setBusy(true)
    const granted = await requestNotifyPermission()
    if (granted) {
      await subscribePushForUser(currentUser.id)
    }
    setPermission(notificationState())
    setBusy(false)
  }

  return (
    <div className="mx-4 mb-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-neutral-200">
      {!standalone ? (
        <p>
          Für Klingeln bei geschlossener App: Teilen →{' '}
          <span className="font-medium text-white">Zum Home-Bildschirm</span>
          , App von dort öffnen, dann Mitteilungen erlauben.
        </p>
      ) : permission === 'denied' ? (
        <p>
          Mitteilungen sind blockiert. iPhone-Einstellungen → Kithan → Mitteilungen
          einschalten.
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="w-full text-left font-medium text-primary"
        >
          {busy ? 'Wird eingeschaltet…' : 'Mitteilungen einschalten (Klingeln + rote 1)'}
        </button>
      )}
    </div>
  )
}
