import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'

interface AddMembersModalProps {
  ticketId: string
  memberIds: string[]
  currentUserId: string
  onClose: () => void
  onAdded: (user: User) => void
}

export function AddMembersModal({
  ticketId,
  memberIds,
  currentUserId,
  onClose,
  onAdded,
}: AddMembersModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const memberSet = new Set(memberIds)

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')
    const scrollY = window.scrollY
    const restore = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      htmlTouch: html.style.touchAction,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyTouch: body.style.touchAction,
      rootOverflow: root?.style.overflow ?? '',
      rootOverscroll: root?.style.overscrollBehavior ?? '',
      rootTouch: root?.style.touchAction ?? '',
    }

    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    html.style.touchAction = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.touchAction = 'none'
    if (root) {
      root.style.overflow = 'hidden'
      root.style.overscrollBehavior = 'none'
      root.style.touchAction = 'none'
    }

    let lastX = 0
    let lastY = 0

    const scrollerFrom = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null
      const el = target.closest('[data-scroll-lock-allow]')
      return el instanceof HTMLElement ? el : null
    }

    const onTouchStart = (event: TouchEvent) => {
      lastX = event.touches[0]?.clientX ?? 0
      lastY = event.touches[0]?.clientY ?? 0
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        event.preventDefault()
        return
      }

      const x = event.touches[0].clientX
      const y = event.touches[0].clientY
      const dx = x - lastX
      const dy = y - lastY
      lastX = x
      lastY = y

      if (Math.abs(dx) >= Math.abs(dy)) {
        event.preventDefault()
        return
      }

      const scroller = scrollerFrom(event.target)
      if (!scroller || scroller.scrollHeight - scroller.clientHeight <= 1) {
        event.preventDefault()
        return
      }

      const atTop = scroller.scrollTop <= 0
      const atBottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
      if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
        event.preventDefault()
      }
    }

    const startOpts: AddEventListenerOptions = { passive: true, capture: true }
    const moveOpts: AddEventListenerOptions = { passive: false, capture: true }
    document.addEventListener('touchstart', onTouchStart, startOpts)
    document.addEventListener('touchmove', onTouchMove, moveOpts)

    return () => {
      document.removeEventListener('touchstart', onTouchStart, startOpts)
      document.removeEventListener('touchmove', onTouchMove, moveOpts)
      html.style.overflow = restore.htmlOverflow
      html.style.overscrollBehavior = restore.htmlOverscroll
      html.style.touchAction = restore.htmlTouch
      body.style.overflow = restore.bodyOverflow
      body.style.overscrollBehavior = restore.bodyOverscroll
      body.style.position = restore.bodyPosition
      body.style.top = restore.bodyTop
      body.style.left = restore.bodyLeft
      body.style.right = restore.bodyRight
      body.style.width = restore.bodyWidth
      body.style.touchAction = restore.bodyTouch
      if (root) {
        root.style.overflow = restore.rootOverflow
        root.style.overscrollBehavior = restore.rootOverscroll
        root.style.touchAction = restore.rootTouch
      }
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      const { data, error: queryError } = await supabase
        .from('users')
        .select('id, name, created_at')
        .order('name', { ascending: true })

      if (cancelled) return
      if (queryError) {
        setError('Mitarbeiter konnten nicht geladen werden.')
        setLoading(false)
        return
      }
      setUsers((data ?? []).filter((user) => user.id !== currentUserId))
      setLoading(false)
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  async function addMember(user: User) {
    if (memberSet.has(user.id) || savingId) return
    setSavingId(user.id)
    setError(null)

    const { error: insertError } = await supabase.from('ticket_members').insert({
      ticket_id: ticketId,
      user_id: user.id,
    })

    setSavingId(null)

    if (insertError) {
      setError('Kollege konnte nicht hinzugefügt werden.')
      return
    }

    onAdded(user)
  }

  const dialog = (
    <div className="fixed inset-0 z-[80] h-[100dvh] w-full max-w-full overflow-hidden overscroll-none bg-black/70 [touch-action:none]">
      <div className="flex h-full w-full max-w-full items-end justify-center overflow-hidden overscroll-none p-4 [touch-action:none] sm:items-center">
        <div
          role="dialog"
          aria-labelledby="add-members-title"
          className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white shadow-xl [touch-action:manipulation]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="add-members-title" className="text-base font-semibold">
              Kollegen hinzufügen
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-neutral-400 hover:text-white"
            >
              Schließen
            </button>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-neutral-400">Lade Liste…</p>
          ) : null}

          {error ? (
            <p className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <ul
            data-scroll-lock-allow
            className="max-h-72 overflow-y-auto overscroll-none [touch-action:pan-y]"
          >
            {users.map((user) => {
              const already = memberSet.has(user.id)
              return (
                <li key={user.id} className="border-b border-neutral-800 last:border-b-0">
                  <button
                    type="button"
                    disabled={already || savingId === user.id}
                    onClick={() => void addMember(user)}
                    className="flex w-full items-center justify-between px-1 py-3 text-left disabled:opacity-40"
                  >
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xl font-light leading-none text-primary">
                      {already ? '✓' : savingId === user.id ? '…' : '+'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return dialog
  return createPortal(dialog, document.body)
}
