import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface FixedSheetProps {
  children: ReactNode
  className?: string
}

export function FixedSheet({ children, className = 'z-50' }: FixedSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const html = document.documentElement
    const previousOverflow = html.style.overflow
    html.style.overflow = 'hidden'

    const pin = () => {
      const viewport = window.visualViewport
      if (!viewport) return
      overlay.style.top = `${viewport.offsetTop}px`
      overlay.style.left = `${viewport.offsetLeft}px`
      overlay.style.width = `${viewport.width}px`
      overlay.style.height = `${viewport.height}px`
      overlay.style.right = 'auto'
      overlay.style.bottom = 'auto'
    }

    const onTouchMove = (event: TouchEvent) => {
      const target = event.target
      const scroller =
        target instanceof Element ? target.closest('[data-sheet-scroll]') : null
      if (scroller instanceof HTMLElement) return
      event.preventDefault()
    }

    pin()
    overlay.addEventListener('touchmove', onTouchMove, { passive: false })
    window.visualViewport?.addEventListener('resize', pin)
    window.visualViewport?.addEventListener('scroll', pin)

    return () => {
      html.style.overflow = previousOverflow
      overlay.removeEventListener('touchmove', onTouchMove)
      window.visualViewport?.removeEventListener('resize', pin)
      window.visualViewport?.removeEventListener('scroll', pin)
    }
  }, [])

  return createPortal(
    <div
      ref={overlayRef}
      className={`fixed inset-0 flex items-end justify-center overflow-hidden overscroll-none bg-black/70 p-4 [touch-action:none] sm:items-center ${className}`}
    >
      {children}
    </div>,
    document.body,
  )
}
