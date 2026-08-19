import { useEffect, useRef } from 'react'
import type { Message, User } from '../../types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  usersById: Map<string, User>
  currentUserId: string
}

export function MessageList({
  messages,
  usersById,
  currentUserId,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-neutral-500">
        Noch keine Nachrichten in diesem Problemraum.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={message.user_id === currentUserId}
          authorName={usersById.get(message.user_id)?.name ?? 'Mitarbeiter'}
        />
      ))}
      <div ref={endRef} />
    </div>
  )
}
