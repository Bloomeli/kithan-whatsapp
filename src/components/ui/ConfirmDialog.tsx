interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white shadow-xl"
      >
        <h2 id="confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-sm leading-relaxed text-neutral-300">
          {message}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-12 flex-1 rounded-xl border border-neutral-800 text-sm font-semibold text-neutral-200 disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`h-12 flex-1 rounded-xl text-sm font-semibold text-white disabled:opacity-40 ${
              danger
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-archive text-black hover:bg-archive/90'
            }`}
          >
            {busy ? 'Bitte warten…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
