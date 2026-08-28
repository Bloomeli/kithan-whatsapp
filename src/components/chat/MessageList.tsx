import { useEffect, useRef } from 'react'
import { messageReceipt } from '../../lib/unread'
import type { Message, TicketMember, User } from '../../types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  usersById: Map<string, User>
  currentUserId: string
  members: TicketMember[]
}

export function MessageList({
  messages,
  usersById,
  currentUserId,
  members,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-neutral-500">
        Noch keine Nachrichten in diesem Problemraum.
      </p>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 px-3 py-3">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={message.user_id === currentUserId}
          authorName={usersById.get(message.user_id)?.name ?? 'Mitarbeiter'}
          receipt={
            message.user_id === currentUserId
              ? messageReceipt(message, currentUserId, members)
              : undefined
          }
        />
      ))}
      <div ref={endRef} />
    </div>
  )
}
