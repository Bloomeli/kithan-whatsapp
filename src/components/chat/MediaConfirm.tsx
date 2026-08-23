import { useEffect, useState } from 'react'

interface MediaConfirmProps {
  file: File
  sending: boolean
  statusText: string | null
  onUse: () => void
  onRetake: () => void
  onDiscard: () => void
}

export function MediaConfirm({
  file,
  sending,
  statusText,
  onUse,
  onRetake,
  onDiscard,
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
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={sending}
          className="text-sm text-neutral-300 disabled:opacity-40"
        >
          Verwerfen
        </button>
        <p className="text-sm font-medium">Vorschau</p>
        <button
          type="button"
          onClick={onRetake}
          disabled={sending}
          className="text-sm text-primary disabled:opacity-40"
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

      {statusText ? (
        <p className="px-4 pt-3 text-center text-sm text-primary">{statusText}</p>
      ) : null}

      <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={onUse}
          disabled={sending}
          className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white disabled:opacity-40"
        >
          {sending ? 'Wird in den Chat geladen…' : 'In den Chat'}
        </button>
      </div>
    </div>
  )
}
