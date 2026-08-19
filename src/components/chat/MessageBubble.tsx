import type { MediaType, Message } from '../../types'

interface MessageBubbleProps {
  message: Message
  authorName: string
  isOwn: boolean
}

export function MessageBubble({ message, authorName, isOwn }: MessageBubbleProps) {
  return (
    <article className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 ${
          isOwn
            ? 'rounded-br-sm bg-primary text-white'
            : 'rounded-bl-sm bg-neutral-800 text-white'
        }`}
      >
        {isOwn ? null : (
          <p className="mb-1 text-[11px] font-semibold text-neutral-300">
            {authorName}
          </p>
        )}
        {message.media_url && message.media_type ? (
          <MediaAttachment url={message.media_url} type={message.media_type} />
        ) : null}
        {message.content.trim() ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
            {message.content}
          </p>
        ) : null}
        <time
          dateTime={message.created_at}
          className={`mt-1 block text-right text-[10px] ${
            isOwn ? 'text-white/70' : 'text-neutral-400'
          }`}
        >
          {formatMessageTime(message.created_at)}
        </time>
      </div>
    </article>
  )
}

function MediaAttachment({ url, type }: { url: string; type: MediaType }) {
  if (type === 'video') {
    return (
      <video
        src={url}
        controls
        playsInline
        className="mb-1 max-h-64 w-full rounded-lg bg-black"
      />
    )
  }

  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        src={url}
        alt="Anhang"
        className="mb-1 max-h-64 w-full rounded-lg object-cover"
      />
    </a>
  )
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
