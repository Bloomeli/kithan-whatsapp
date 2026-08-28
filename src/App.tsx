import { useCallback, useEffect, useState } from 'react'
import {
  LoginDropdown,
  clearStoredUser,
  readStoredUser,
  resolveStoredUser,
} from './components/auth/LoginDropdown'
import { TicketRoom } from './components/chat/TicketRoom'
import { TicketList } from './components/dashboard/TicketList'
import { OfflineBanner } from './components/OfflineBanner'
import { PushEnableBanner } from './components/PushEnableBanner'
import { MessageToast } from './components/ui/MessageToast'
import { useIncomingAlerts } from './hooks/useIncomingAlerts'
import {
  fetchAccessibleTicket,
  parseTicketHash,
  ticketHash,
} from './lib/tickets'
import type { Ticket, User } from './types'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    readStoredUser(),
  )
  const [showArchived, setShowArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  useEffect(() => {
    let cancelled = false
    void resolveStoredUser().then((user) => {
      if (cancelled) return
      setCurrentUser(user)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    function onWorkerMessage(event: MessageEvent) {
      const url = event.data?.url as string | undefined
      if (event.data?.type !== 'open-ticket' || !url) return
      const hashIndex = url.indexOf('#')
      if (hashIndex >= 0) {
        window.location.hash = url.slice(hashIndex)
      }
    }

    navigator.serviceWorker.addEventListener('message', onWorkerMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', onWorkerMessage)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return

    const userId = currentUser.id
    let cancelled = false

    async function syncFromHash() {
      const ticketId = parseTicketHash(window.location.hash)
      if (!ticketId) return

      const ticket = await fetchAccessibleTicket(ticketId, userId)
      if (cancelled) return

      if (ticket) {
        setSelectedTicket(ticket)
        return
      }

      clearTicketHash()
    }

    function onHashChange() {
      const ticketId = parseTicketHash(window.location.hash)
      if (!ticketId) {
        setSelectedTicket(null)
        return
      }
      void syncFromHash()
    }

    void syncFromHash()
    window.addEventListener('hashchange', onHashChange)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [currentUser])

  const openTicket = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket)
    const next = ticketHash(ticket.id)
    if (window.location.hash !== next) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${next}`,
      )
    }
  }, [])

  const closeTicket = useCallback(() => {
    setSelectedTicket(null)
    clearTicketHash()
  }, [])

  const { unreadCounts, toast, openToastTicket } = useIncomingAlerts(
    currentUser,
    selectedTicket?.id ?? null,
    openTicket,
  )

  function logout() {
    clearStoredUser()
    closeTicket()
    setCurrentUser(null)
  }

  if (!currentUser) {
    return (
      <>
        <OfflineBanner />
        <LoginDropdown onSelect={setCurrentUser} />
      </>
    )
  }

  if (selectedTicket) {
    return (
      <>
        <OfflineBanner />
        {toast ? (
          <MessageToast
            title={toast.title}
            body={toast.body}
            onOpen={() => void openToastTicket()}
          />
        ) : null}
        <TicketRoom
          ticket={selectedTicket}
          currentUser={currentUser}
          onBack={closeTicket}
          onTicketUpdated={setSelectedTicket}
        />
      </>
    )
  }

  return (
    <div className="flex min-h-svh w-full min-w-0 flex-col bg-black text-white">
      <OfflineBanner />
      {toast ? (
        <MessageToast
          title={toast.title}
          body={toast.body}
          onOpen={() => void openToastTicket()}
        />
      ) : null}
      <header
        className={`flex w-full min-w-0 justify-between gap-3 border-b border-neutral-800 bg-neutral-950 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] ${
          showArchived ? 'items-start' : 'items-center'
        }`}
      >
        <div
          className={`flex min-w-0 gap-1 ${
            showArchived ? 'items-start' : 'items-center'
          }`}
        >
          {showArchived ? (
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              aria-label="Zurück zu Problemräume"
              className="flex h-10 w-10 shrink-0 items-center justify-center text-primary"
            >
              <BackIcon />
            </button>
          ) : null}
          <div className="min-w-0 pt-1">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-primary uppercase">
              Kithan
            </p>
            <h1
              className={`font-semibold tracking-tight ${
                showArchived
                  ? 'text-base leading-snug'
                  : 'truncate text-lg'
              }`}
            >
              {showArchived ? 'Abgeschlossene Problemräume' : 'Problemräume'}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showArchived ? null : (
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className="text-sm font-medium text-neutral-400 transition hover:text-white"
            >
              Archiv
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Neue Meldung/Problem erstellen"
            className="flex h-11 w-11 items-center justify-center text-2xl font-light text-primary"
          >
            +
          </button>
        </div>
      </header>
      <div className="flex items-center justify-end gap-3 px-4 py-2 text-xs">
        <p className="max-w-28 truncate text-neutral-400 sm:max-w-none">
          {currentUser.name}
        </p>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-primary transition hover:text-white"
        >
          Abmelden
        </button>
      </div>
      <PushEnableBanner currentUser={currentUser} />

      <TicketList
        currentUser={currentUser}
        showArchived={showArchived}
        createOpen={createOpen}
        unreadCounts={unreadCounts}
        onCreateOpenChange={setCreateOpen}
        onSelectTicket={openTicket}
        onCreatedActive={() => setShowArchived(false)}
      />
    </div>
  )
}

function clearTicketHash() {
  if (!window.location.hash) return
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`,
  )
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M15 5 8 12l7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default App
