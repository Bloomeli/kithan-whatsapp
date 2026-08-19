import { useRef, useState, type FormEvent } from 'react'

interface ChatComposerProps {
  sending: boolean
  statusText: string | null
  onSend: (text: string, file: File | null) => Promise<void>
}

export function ChatComposer({ sending, statusText, onSend }: ChatComposerProps) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canSend = !sending && (text.trim().length > 0 || file !== null)

  async function send() {
    if (!canSend) return
    try {
      await onSend(text, file)
      setText('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      // Fehlermeldung kommt aus TicketRoom
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-neutral-800 bg-neutral-950 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
    >
      {file ? (
        <p className="truncate px-2 pb-1 text-xs text-neutral-400">
          Anhang: {file.name}
          <button
            type="button"
            onClick={() => {
              setFile(null)
              if (fileRef.current) fileRef.current.value = ''
            }}
            className="ml-2 text-primary"
          >
            Entfernen
          </button>
        </p>
      ) : null}

      {statusText ? (
        <p className="px-2 pb-1 text-xs text-primary">{statusText}</p>
      ) : null}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={sending}
          aria-label="Foto oder Video anhängen"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:text-white disabled:opacity-40"
        >
          <PaperclipIcon />
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
  )
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M21.44 11.05 12 20.5a6 6 0 0 1-8.49-8.49l9.9-9.9a4 4 0 0 1 5.66 5.66l-9.9 9.9a2 2 0 1 1-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
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
