import { useCallback, useEffect, useState } from 'react'
import {
  LoginDropdown,
  clearStoredUser,
  readStoredUser,
} from './components/auth/LoginDropdown'
import { TicketRoom } from './components/chat/TicketRoom'
import { TicketList } from './components/dashboard/TicketList'
import { OfflineBanner } from './components/OfflineBanner'
import { purgeExpiredChatMedia } from './lib/mediaTtl'
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
    if (!currentUser) return
    void purgeExpiredChatMedia()
  }, [currentUser])

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
    <div className="flex min-h-svh flex-col bg-black text-white">
      <OfflineBanner />
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.24em] text-primary uppercase">
            Kithan
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {showArchived ? 'Archiv' : 'Problemräume'}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArchived((current) => !current)}
            className={`text-sm font-medium transition ${
              showArchived ? 'text-archive' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Archiv
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Neuen Problemraum erstellen"
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

      <TicketList
        currentUser={currentUser}
        showArchived={showArchived}
        createOpen={createOpen}
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

export default App
