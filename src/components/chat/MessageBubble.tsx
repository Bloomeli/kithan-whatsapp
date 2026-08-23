import { useRef, useState } from 'react'
import { isChatMediaExpired, MEDIA_TTL_HOURS } from '../../lib/mediaTtl'
import type { ReceiptStatus } from '../../lib/unread'
import type { MediaType, Message } from '../../types'

interface MessageBubbleProps {
  message: Message
  authorName: string
  isOwn: boolean
  receipt?: ReceiptStatus
}

export function MessageBubble({
  message,
  authorName,
  isOwn,
  receipt,
}: MessageBubbleProps) {
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
        {message.media_url && message.media_type && !isChatMediaExpired(message.created_at) ? (
          <MediaAttachment url={message.media_url} type={message.media_type} />
        ) : null}
        {message.media_type &&
        (!message.media_url || isChatMediaExpired(message.created_at)) ? (
          <p
            className={`mb-1 text-[12px] leading-snug ${
              isOwn ? 'text-white/70' : 'text-neutral-400'
            }`}
          >
            {message.media_type === 'video'
              ? `Video nach ${MEDIA_TTL_HOURS} Stunden gelöscht`
              : `Foto nach ${MEDIA_TTL_HOURS} Stunden gelöscht`}
          </p>
        ) : null}
        {message.content.trim() ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
            {message.content}
          </p>
        ) : null}
        <div className="mt-1 flex items-center justify-end gap-1">
          <time
            dateTime={message.created_at}
            className={`text-[10px] ${
              isOwn ? 'text-white/70' : 'text-neutral-400'
            }`}
          >
            {formatMessageTime(message.created_at)}
          </time>
          {isOwn && receipt ? <ReceiptTicks status={receipt} /> : null}
        </div>
      </div>
    </article>
  )
}

function MediaAttachment({ url, type }: { url: string; type: MediaType }) {
  if (type === 'video') {
    return <VideoPreview url={url} />
  }

  return <ImagePreview url={url} />
}

function ImagePreview({ url }: { url: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-1 block w-full overflow-hidden rounded-lg"
        aria-label="Foto vergrößern"
      >
        <img
          src={url}
          alt="Foto"
          className="max-h-64 w-full object-cover"
        />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Foto"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <img
            src={url}
            alt="Foto"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}
    </>
  )
}

function VideoPreview({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  function startPlayback() {
    setPlaying(true)
    void videoRef.current?.play()
  }

  return (
    <div className="relative mb-1 overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        src={url}
        playsInline
        preload="metadata"
        controls={playing}
        className="max-h-64 w-full"
        onPlay={() => setPlaying(true)}
        onEnded={() => setPlaying(false)}
      />
      {playing ? null : (
        <button
          type="button"
          onClick={startPlayback}
          aria-label="Video abspielen"
          className="absolute inset-0 flex items-center justify-center bg-black/35"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_0_12px_rgba(26,107,255,0.55)]">
            <PlayIcon />
          </span>
        </button>
      )}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}

function ReceiptTicks({ status }: { status: ReceiptStatus }) {
  const label =
    status === 'read' ? 'Gelesen' : status === 'delivered' ? 'Zugestellt' : 'Gesendet'
  const color = status === 'read' ? 'text-[#7ec8ff]' : 'text-white/55'

  return (
    <span aria-label={label} className={color}>
      {status === 'sent' ? <SingleCheckIcon /> : <DoubleCheckIcon />}
    </span>
  )
}

function SingleCheckIcon() {
  return (
    <svg viewBox="0 0 16 12" className="h-3 w-4" fill="none" aria-hidden>
      <path
        d="M1 6.5 5 10.5 15 1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DoubleCheckIcon() {
  return (
    <svg viewBox="0 0 20 12" className="h-3 w-5" fill="none" aria-hidden>
      <path
        d="M1 6.5 5 10.5 11.5 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 8.5 9 10.5 19 1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
