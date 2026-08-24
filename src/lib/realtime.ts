import type { RealtimeChannel } from '@supabase/supabase-js'

/** Genau ein Catch-up nach Reconnect oder wenn die App wieder sichtbar wird. Kein Intervall. */
export function bindRealtimeCatchUp(
  channel: RealtimeChannel,
  catchUp: () => void | Promise<void>,
) {
  let skipNextSubscribed = true
  let inFlight = false
  let pending = false

  function runCatchUp() {
    if (inFlight) {
      pending = true
      return
    }
    inFlight = true
    Promise.resolve(catchUp()).finally(() => {
      inFlight = false
      if (pending) {
        pending = false
        runCatchUp()
      }
    })
  }

  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    if (skipNextSubscribed) {
      skipNextSubscribed = false
      return
    }
    runCatchUp()
  })

  function onVisible() {
    if (document.visibilityState === 'visible') runCatchUp()
  }

  document.addEventListener('visibilitychange', onVisible)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
  }
}
