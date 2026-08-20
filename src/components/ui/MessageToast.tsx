interface MessageToastProps {
  title: string
  body: string
  onOpen: () => void
}

export function MessageToast({ title, body, onOpen }: MessageToastProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 left-3 z-[70] rounded-2xl border border-primary/40 bg-neutral-950 px-4 py-3 text-left shadow-[0_8px_32px_rgba(26,107,255,0.35)]"
    >
      <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">
        Neue Nachricht
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-white">{title}</p>
      <p className="mt-0.5 truncate text-[13px] text-neutral-300">{body}</p>
    </button>
  )
}
