/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
void self.skipWaiting()
clientsClaim()

// Cache-Buster: Home-Screen-Icon auf dem iPhone muss diese Version neu laden.
const CACHE_RELEASE = '2026-08-24-push-always'
void CACHE_RELEASE

type PushPayload = {
  title?: string
  body?: string
  tag?: string
  url?: string
  unread?: number
}

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = String(event.notification.data?.url ?? '/')
  event.waitUntil(openApp(url))
})

async function handlePush(event: PushEvent) {
  let data: PushPayload = {}
  try {
    data = event.data ? (event.data.json() as PushPayload) : {}
  } catch {
    data = { body: event.data?.text() ?? 'Neue Nachricht' }
  }

  try {
    const badge = Math.max(1, data.unread ?? 1)
    if ('setAppBadge' in self.navigator) {
      await self.navigator.setAppBadge(badge)
    }
  } catch {
    // Badge ist auf manchen iPhones optional
  }

  await self.registration.showNotification(data.title || 'Kithan', {
    body: data.body || 'Neue Nachricht',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'kithan-message',
    data: { url: data.url || '/' },
    silent: false,
    lang: 'de',
  })
}

async function openApp(url: string) {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const client of windows) {
    if ('focus' in client) {
      await client.focus()
      client.postMessage({ type: 'open-ticket', url })
      return
    }
  }
  await self.clients.openWindow(url)
}
