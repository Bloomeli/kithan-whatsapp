import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { isVideoOverTimeLimit } from '../../lib/media'
import { VideoRecorder } from './VideoRecorder'

interface ChatComposerProps {
  sending: boolean
  statusText: string | null
  onSend: (text: string, file: File | null) => Promise<void>
}

const TIME_LIMIT_WARNING =
  'Zeitlimit erreicht. Falls nötig, bitte ein weiteres Video erneut aufnehmen.'

export function ChatComposer({ sending, statusText, onSend }: ChatComposerProps) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [recorderOpen, setRecorderOpen] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  const canSend = !sending && (text.trim().length > 0 || file !== null)

  async function send() {
    if (!canSend) return
    try {
      await onSend(text, file)
      setText('')
      clearAttachment()
      setLocalError(null)
      setWarning(null)
    } catch {
      // Fehlermeldung kommt aus TicketRoom
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send()
  }

  function clearAttachment() {
    setFile(null)
    if (photoRef.current) photoRef.current.value = ''
    if (videoRef.current) videoRef.current.value = ''
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    if (videoRef.current) videoRef.current.value = ''
    setLocalError(null)
    setWarning(null)
    setFile(next)
  }

  async function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    setRecorderOpen(false)

    if (!next) {
      setLocalError(null)
      return
    }

    if (photoRef.current) photoRef.current.value = ''
    setLocalError(null)
    setFile(next)

    const overLimit = await isVideoOverTimeLimit(next)
    if (!overLimit) {
      setWarning(null)
      return
    }

    setWarning(TIME_LIMIT_WARNING)

    try {
      await onSend(text, next)
      setText('')
      clearAttachment()
    } catch {
      // Die ersten 30 Sekunden bleiben als Anhang erhalten
    }
  }

  async function handleRecorded(next: File, hitTimeLimit: boolean) {
    setRecorderOpen(false)
    if (photoRef.current) photoRef.current.value = ''
    if (videoRef.current) videoRef.current.value = ''
    setFile(next)
    setLocalError(null)

    if (!hitTimeLimit) {
      setWarning(null)
      return
    }

    setWarning(TIME_LIMIT_WARNING)

    try {
      await onSend(text, next)
      setText('')
      clearAttachment()
    } catch {
      // Clip bleibt als Anhang erhalten
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="border-t border-neutral-800 bg-neutral-950 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      >
        {file ? (
          <p className="truncate pb-1 text-xs text-neutral-400">
            Anhang: {file.name}
            <button
              type="button"
              onClick={clearAttachment}
              className="ml-2 text-primary"
            >
              Entfernen
            </button>
          </p>
        ) : null}

        {localError ? (
          <p className="pb-1 text-xs text-red-300">{localError}</p>
        ) : null}

        {warning ? (
          <p className="pb-1 text-xs text-yellow-300">{warning}</p>
        ) : null}

        {statusText ? (
          <p className="pb-1 text-xs text-primary">{statusText}</p>
        ) : null}

        <div className="flex items-end gap-1.5">
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => void handleVideoChange(event)}
          />
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            disabled={sending}
            aria-label="Foto aufnehmen oder aus der Galerie wählen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary disabled:opacity-40"
          >
            <CameraIcon />
          </button>
          <button
            type="button"
            onClick={() => setRecorderOpen(true)}
            disabled={sending}
            aria-label="Video aufnehmen oder aus der Galerie wählen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary disabled:opacity-40"
          >
            <VideoIcon />
          </button>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Nachricht"
            rows={1}
            disabled={sending}
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-neutral-800 bg-black px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-neutral-500 focus:border-primary"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
            aria-label="Senden"
          >
            <SendIcon />
          </button>
        </div>
      </form>

      {recorderOpen ? (
        <VideoRecorder
          onCaptured={(next, hitTimeLimit) => {
            void handleRecorded(next, hitTimeLimit)
          }}
          onPickGallery={() => videoRef.current?.click()}
          onCancel={() => setRecorderOpen(false)}
        />
      ) : null}
    </>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M4.5 8.5h2.2l1.3-2h8l1.3 2h2.2A1.5 1.5 0 0 1 21 10v8.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5V10a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <rect
        x="3"
        y="6.5"
        width="13"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16 10.2 21 7.5v9l-5-2.7v-3.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M3.4 20.6 21 12 3.4 3.4 3 10l11 2-11 2z" />
    </svg>
  )
}
