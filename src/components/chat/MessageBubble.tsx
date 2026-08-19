import { useRef, useState } from 'react'
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

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
