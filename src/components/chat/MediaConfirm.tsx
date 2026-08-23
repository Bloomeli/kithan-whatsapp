import { useEffect, useState } from 'react'

interface MediaConfirmProps {
  file: File
  sending: boolean
  statusText: string | null
  error: string | null
  onUse: () => void
  onRetake: () => void
  onDiscard: () => void
  onBackToChat: () => void
}

export function MediaConfirm({
  file,
  sending,
  statusText,
  error,
  onUse,
  onRetake,
  onDiscard,
  onBackToChat,
}: MediaConfirmProps) {
  const [preview, setPreview] = useState('')
  const isVideo = file.type.startsWith('video/')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="grid grid-cols-3 items-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={sending}
          className="justify-self-start text-sm text-primary disabled:opacity-40"
        >
          Verwerfen
        </button>
        <p className="text-center text-sm font-medium text-white">Vorschau</p>
        <button
          type="button"
          onClick={onRetake}
          disabled={sending}
          className="justify-self-end text-sm text-primary disabled:opacity-40"
        >
          Neu aufnehmen
        </button>
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        {preview && isVideo ? (
          <video
            src={preview}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        ) : null}
        {preview && !isVideo ? (
          <img
            src={preview}
            alt="Aufnahme"
            className="h-full w-full object-contain"
          />
        ) : null}
      </div>

      {error ? (
        <p className="px-4 pt-3 text-center text-sm text-red-300">{error}</p>
      ) : null}

      {statusText && !error ? (
        <p className="px-4 pt-3 text-center text-sm text-primary">{statusText}</p>
      ) : null}

      <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={onUse}
          disabled={sending}
          className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white disabled:opacity-40"
        >
          {sending ? 'Wird in den Chat geladen…' : error ? 'Erneut versuchen' : 'In den Chat'}
        </button>
        <button
          type="button"
          onClick={onBackToChat}
          disabled={sending}
          className="mt-2 h-11 w-full text-sm text-primary disabled:opacity-40"
        >
          Zum Chat
        </button>
      </div>
    </div>
  )
}
