import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )

  useEffect(() => {
    function goOffline() {
      setOffline(true)
    }
    function goOnline() {
      setOffline(false)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <p className="bg-urgent px-4 py-2 text-center text-sm font-medium text-black">
      Offline. Die App bleibt geöffnet; neue Nachrichten brauchen wieder Netz.
    </p>
  )
}
