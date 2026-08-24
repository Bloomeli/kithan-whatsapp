import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bindRealtimeCatchUp } from '../lib/realtime'
import { fetchAccessibleTicket } from '../lib/tickets'
import { subscribePushForUser } from '../lib/push'
import {
  fetchUnreadCounts,
  markTicketRead,
  playNotifySound,
  requestNotifyPermission,
  setHomeScreenBadge,
  showSystemNotification,
  totalUnread,
  unlockNotifyAudio,
} from '../lib/unread'
import type { Message, Ticket, User } from '../types'

export type IncomingToast = {
  ticketId: string
  title: string
  body: string
}

export function useIncomingAlerts(
  currentUser: User | null,
  openTicketId: string | null,
  onOpenTicket: (ticket: Ticket) => void,
) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<IncomingToast | null>(null)
  const openTicketIdRef = useRef(openTicketId)
  const memberIdsRef = useRef(new Set<string>())
  const toastTimerRef = useRef<number | null>(null)

  openTicketIdRef.current = openTicketId

  const refreshUnread = useCallback(async () => {
    if (!currentUser) return
    const counts = await fetchUnreadCounts(currentUser.id)
    setUnreadCounts(counts)
    await setHomeScreenBadge(totalUnread(counts))
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      setUnreadCounts({})
      void setHomeScreenBadge(0)
      return
    }

    void requestNotifyPermission().then((granted) => {
      if (granted) void subscribePushForUser(currentUser.id)
    })
    void refreshUnread()

    const userId = currentUser.id
    function onFirstGesture() {
      unlockNotifyAudio()
      void requestNotifyPermission().then((granted) => {
        if (granted) void subscribePushForUser(userId)
      })
    }
    window.addEventListener('pointerdown', onFirstGesture, { once: true })
    return () => window.removeEventListener('pointerdown', onFirstGesture)
  }, [currentUser, refreshUnread])

  useEffect(() => {
    if (!currentUser || !openTicketId) return
    void markTicketRead(openTicketId, currentUser.id).then(() => {
      setUnreadCounts((current) => {
        const next = { ...current, [openTicketId]: 0 }
        void setHomeScreenBadge(totalUnread(next))
        return next
      })
    })
  }, [currentUser, openTicketId])

  useEffect(() => {
    if (!currentUser) return
    const userId = currentUser.id
    let cancelled = false

    async function loadMemberIds() {
      const { data } = await supabase
        .from('ticket_members')
        .select('ticket_id')
        .eq('user_id', userId)
      if (cancelled) return
      memberIdsRef.current = new Set((data ?? []).map((row) => row.ticket_id))
    }

    const seenIds = { current: new Set<string>() }

    async function handleIncoming(message: Message) {
      if (message.user_id === userId) return
      if (seenIds.current.has(message.id)) return
      seenIds.current.add(message.id)
      if (typeof navigator !== 'undefined' && !navigator.onLine) return

      if (!memberIdsRef.current.has(message.ticket_id)) {
        await loadMemberIds()
        if (!memberIdsRef.current.has(message.ticket_id)) return
      }

      if (openTicketIdRef.current === message.ticket_id) {
        await markTicketRead(message.ticket_id, userId)
        return
      }

      setUnreadCounts((current) => {
        const next = {
          ...current,
          [message.ticket_id]: (current[message.ticket_id] ?? 0) + 1,
        }
        void setHomeScreenBadge(totalUnread(next))
        return next
      })

      const [{ data: ticket }, { data: sender }] = await Promise.all([
        supabase.from('tickets').select('title').eq('id', message.ticket_id).maybeSingle(),
        supabase.from('users').select('name').eq('id', message.user_id).maybeSingle(),
      ])

      const title = ticket?.title ?? 'Problemraum'
      const senderName = sender?.name ?? 'Kollege'
      const preview =
        message.content.trim() ||
        (message.media_type === 'video' ? 'Video' : message.media_type === 'image' ? 'Foto' : 'Nachricht')
      const body = `${senderName}: ${preview}`

      if (document.visibilityState !== 'visible') {
        showSystemNotification(title, body, message.ticket_id)
      } else {
        playNotifySound()
        setToast({ ticketId: message.ticket_id, title, body })
        if (toastTimerRef.current !== null) {
          window.clearTimeout(toastTimerRef.current)
        }
        toastTimerRef.current = window.setTimeout(() => setToast(null), 6000)
      }
    }

    async function catchUp() {
      if (cancelled) return
      await loadMemberIds()
      await refreshUnread()
      const ticketIds = [...memberIdsRef.current]
      if (ticketIds.length === 0) return
      const { data } = await supabase
        .from('messages')
        .select('id')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false })
        .limit(40)
      if (cancelled || !data) return
      for (const row of data) seenIds.current.add(row.id)
    }

    void loadMemberIds().then(() => {
      if (!cancelled) void catchUp()
    })

    const channel = supabase
      .channel(`incoming-messages-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          void handleIncoming(payload.new as Message)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_members',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadMemberIds().then(() => {
            if (!cancelled) void refreshUnread()
          })
        },
      )

    const unbindCatchUp = bindRealtimeCatchUp(channel, () => {
      void catchUp()
    })

    return () => {
      cancelled = true
      unbindCatchUp()
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current)
      }
      void supabase.removeChannel(channel)
    }
  }, [currentUser, refreshUnread])

  async function openToastTicket() {
    if (!currentUser || !toast) return
    const ticket = await fetchAccessibleTicket(toast.ticketId, currentUser.id)
    setToast(null)
    if (ticket) onOpenTicket(ticket)
  }

  return {
    unreadCounts,
    toast,
    dismissToast: () => setToast(null),
    openToastTicket,
  }
}
