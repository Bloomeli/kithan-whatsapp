import { useEffect, useMemo, useRef, useState } from 'react'
import { prepareChatMedia, uploadChatMedia } from '../../lib/media'
import { notifyTicketMembers } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import { deleteTicketCompletely, ensureTicketMembership, fetchAccessibleTicket } from '../../lib/tickets'
import type {
  Message,
  Ticket,
  TicketMember,
  TicketPriority,
  TicketStatus,
  User,
} from '../../types'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EditTicketModal } from '../dashboard/EditTicketModal'
import { AddMembersModal } from './AddMembersModal'
import { ChatComposer } from './ChatComposer'
import { MessageList } from './MessageList'
import { TicketMetaSelect } from './TicketMetaSelect'

interface TicketRoomProps {
  ticket: Ticket
  currentUser: User
  onBack: () => void
  onTicketUpdated: (ticket: Ticket) => void
}

export function TicketRoom({
  ticket,
  currentUser,
  onBack,
  onTicketUpdated,
}: TicketRoomProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [members, setMembers] = useState<TicketMember[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const longPressRef = useRef(false)
  const titleTimerRef = useRef<number | null>(null)

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  )

  useEffect(() => {
    let cancelled = false

    async function loadRoom() {
      await ensureTicketMembership(ticket.id, currentUser.id)
      const accessible = await fetchAccessibleTicket(ticket.id, currentUser.id)
      if (cancelled) return

      if (!accessible) {
        onBack()
        return
      }

      const [messagesResult, usersResult, membersResult] = await Promise.all([
        supabase
          .from('messages')
          .select(
            'id, ticket_id, user_id, content, media_url, media_type, created_at',
          )
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: true }),
        supabase.from('users').select('id, name, created_at'),
        supabase
          .from('ticket_members')
          .select('id, ticket_id, user_id, added_at')
          .eq('ticket_id', ticket.id),
      ])

      if (cancelled) return

      if (messagesResult.error || usersResult.error || membersResult.error) {
        setError('Problemraum konnte nicht geladen werden.')
        return
      }

      setMessages(messagesResult.data ?? [])
      setUsers(usersResult.data ?? [])
      setMembers(membersResult.data ?? [])
    }

    void loadRoom()

    const channel = supabase
      .channel(`ticket-messages-${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          setMessages((current) => {
            if (current.some((entry) => entry.id === incoming.id)) return current
            return [...current, incoming]
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [ticket.id, currentUser.id, onBack])

  const currentStatus = ticket.status[0] ?? 'open'

  async function handleStatusChange(next: TicketStatus) {
    const { data, error: updateError } = await supabase
      .from('tickets')
      .update({ status: [next], archived: false })
      .eq('id', ticket.id)
      .select()
      .single()

    if (updateError || !data) {
      setError('Status konnte nicht gespeichert werden.')
      return
    }

    onTicketUpdated(data)
  }

  async function handlePriorityChange(next: TicketPriority) {
    const { data, error: updateError } = await supabase
      .from('tickets')
      .update({ priority: next })
      .eq('id', ticket.id)
      .select()
      .single()

    if (updateError || !data) {
      setError('Dringlichkeit konnte nicht gespeichert werden.')
      return
    }

    onTicketUpdated(data)
  }

  async function handleArchive() {
    setActionBusy(true)
    const { data, error: updateError } = await supabase
      .from('tickets')
      .update({
        archived: true,
        status: ['done'],
        archived_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .select()
      .single()

    setActionBusy(false)
    setConfirmArchive(false)

    if (updateError || !data) {
      setError('Abschließen ist fehlgeschlagen.')
      return
    }

    onTicketUpdated(data)
    onBack()
  }

  async function handleDelete() {
    setActionBusy(true)
    const { error: deleteError } = await deleteTicketCompletely(ticket.id)
    setActionBusy(false)
    setConfirmDelete(false)

    if (deleteError) {
      setError(deleteError)
      return
    }

    onBack()
  }

  async function handleSend(text: string, file: File | null) {
    setSending(true)
    setError(null)
    setStatusText(file ? 'Medium wird vorbereitet…' : null)

    try {
      let mediaUrl: string | null = null
      let mediaType: Message['media_type'] = null

      if (file) {
        const prepared = await prepareChatMedia(file)
        setStatusText('Upload läuft…')
        mediaUrl = await uploadChatMedia(ticket.id, prepared.file)
        mediaType = prepared.mediaType
      }

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          ticket_id: ticket.id,
          user_id: currentUser.id,
          content: text.trim(),
          media_url: mediaUrl,
          media_type: mediaType,
        })
        .select(
          'id, ticket_id, user_id, content, media_url, media_type, created_at',
        )
        .single()

      if (insertError || !data) {
        throw new Error('Nachricht konnte nicht gesendet werden.')
      }

      setMessages((current) => {
        if (current.some((entry) => entry.id === data.id)) return current
        return [...current, data]
      })

      const preview =
        text.trim() ||
        (mediaType === 'video' ? 'Video' : mediaType === 'image' ? 'Foto' : 'Nachricht')
      void notifyTicketMembers({
        ticketId: ticket.id,
        senderId: currentUser.id,
        title: ticket.title,
        body: `${currentUser.name}: ${preview}`,
      })
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Senden ist fehlgeschlagen.',
      )
      throw sendError
    } finally {
      setSending(false)
      setStatusText(null)
    }
  }

  return (
    <div className="flex h-svh flex-col bg-black text-white">
      <header className="border-b border-neutral-800 bg-neutral-950 px-2 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Zurück zur Liste"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-primary"
          >
            <BackIcon />
          </button>
          <h1
            className="min-w-0 flex-1 truncate text-base font-semibold select-none"
            onPointerDown={() => {
              longPressRef.current = false
              if (titleTimerRef.current !== null) {
                window.clearTimeout(titleTimerRef.current)
              }
              titleTimerRef.current = window.setTimeout(() => {
                longPressRef.current = true
                setEditOpen(true)
              }, 550)
            }}
            onPointerUp={() => {
              if (titleTimerRef.current !== null) {
                window.clearTimeout(titleTimerRef.current)
                titleTimerRef.current = null
              }
            }}
            onPointerCancel={() => {
              if (titleTimerRef.current !== null) {
                window.clearTimeout(titleTimerRef.current)
                titleTimerRef.current = null
              }
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            {ticket.title}
          </h1>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Mitarbeiter hinzufügen"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-2xl font-light text-primary"
          >
            +
          </button>
        </div>
        <div className="px-2 pt-1">
          <TicketMetaSelect
            status={currentStatus}
            priority={ticket.priority}
            archived={ticket.archived}
            onStatusChange={(next) => void handleStatusChange(next)}
            onPriorityChange={(next) => void handlePriorityChange(next)}
            onArchive={() => setConfirmArchive(true)}
            onDelete={ticket.archived ? () => setConfirmDelete(true) : undefined}
          />
          <TicketIncidentSummary ticket={ticket} />
        </div>
      </header>

      {error ? (
        <p className="mx-3 mt-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList
          messages={messages}
          usersById={usersById}
          currentUserId={currentUser.id}
        />
      </div>

      <ChatComposer
        sending={sending}
        statusText={statusText}
        onSend={handleSend}
      />

      {addOpen ? (
        <AddMembersModal
          ticketId={ticket.id}
          memberIds={members.map((member) => member.user_id)}
          currentUserId={currentUser.id}
          onClose={() => setAddOpen(false)}
          onAdded={(user) => {
            setMembers((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                ticket_id: ticket.id,
                user_id: user.id,
                added_at: new Date().toISOString(),
              },
            ])
            if (!usersById.has(user.id)) {
              setUsers((current) => [...current, user])
            }
          }}
        />
      ) : null}

      {editOpen ? (
        <EditTicketModal
          ticket={ticket}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => {
            onTicketUpdated(next)
            setEditOpen(false)
          }}
        />
      ) : null}

      {confirmArchive ? (
        <ConfirmDialog
          title="Problem abschließen"
          message="Wollen Sie den Problemraum wirklich abschließen?"
          confirmLabel="Abschließen"
          busy={actionBusy}
          onCancel={() => setConfirmArchive(false)}
          onConfirm={() => void handleArchive()}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Löschen"
          message="Wollen Sie wirklich die Datei löschen?"
          confirmLabel="Löschen"
          danger
          busy={actionBusy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
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

function TicketIncidentSummary({ ticket }: { ticket: Ticket }) {
  const lines = [
    ticket.building_label,
    ticket.unit_location,
    ticket.tenant_name ? `Mieter: ${ticket.tenant_name}` : null,
    ticket.occurred_at ? `Wann: ${formatOccurredAt(ticket.occurred_at)}` : null,
    ticket.reported_by ? `Gemeldet von: ${ticket.reported_by}` : null,
  ].filter((line): line is string => Boolean(line))

  if (lines.length === 0) return null

  return (
    <div className="mt-2 space-y-0.5 text-[12px] leading-snug text-neutral-400">
      {lines.map((line) => (
        <p key={line} className="truncate">
          {line}
        </p>
      ))}
    </div>
  )
}

function formatOccurredAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
