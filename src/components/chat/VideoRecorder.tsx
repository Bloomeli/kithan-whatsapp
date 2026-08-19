import { useEffect, useRef, useState } from 'react'
import {
  MAX_VIDEO_SECONDS,
  VIDEO_BITRATE,
  pickChatRecorderMime,
} from '../../lib/media'

interface VideoRecorderProps {
  onCaptured: (file: File, hitTimeLimit: boolean) => void
  onPickGallery: () => void
  onCancel: () => void
}

export function VideoRecorder({
  onCaptured,
  onPickGallery,
  onCancel,
}: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const hitLimitRef = useRef(false)
  const stoppingRef = useRef(false)
  const [live, setLive] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })
        if (cancelled) {
          stopStream(stream)
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setLive(true)
      } catch {
        if (!cancelled) {
          setError('Kamera konnte nicht gestartet werden. Prüfe die Berechtigung.')
        }
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
      if (streamRef.current) stopStream(streamRef.current)
    }
  }, [])

  useEffect(() => {
    if (!recording) return

    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000
      setElapsed(Math.min(seconds, MAX_VIDEO_SECONDS))
      if (seconds >= MAX_VIDEO_SECONDS) {
        finishRecording(true)
      }
    }, 100)

    return () => window.clearInterval(timer)
  }, [recording])

  function finishRecording(hitTimeLimit: boolean) {
    if (stoppingRef.current) return
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    stoppingRef.current = true
    hitLimitRef.current = hitTimeLimit
    recorder.stop()
  }

  function startRecording() {
    const stream = streamRef.current
    if (!stream || recording) return

    const mimeType = pickChatRecorderMime()
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
    })

    chunksRef.current = []
    hitLimitRef.current = false
    stoppingRef.current = false
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onerror = () => {
      setError('Aufnahme ist fehlgeschlagen.')
      setRecording(false)
    }
    recorder.onstop = () => {
      setRecording(false)
      const blob = new Blob(chunksRef.current, { type: mimeType })
      if (blob.size === 0) {
        setError('Es wurde kein Video gespeichert.')
        return
      }
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([blob], `aufnahme.${extension}`, {
        type: mimeType,
        lastModified: Date.now(),
      })
      onCaptured(file, hitLimitRef.current)
    }

    recorderRef.current = recorder
    recorder.start(250)
    setElapsed(0)
    setRecording(true)
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-neutral-300"
        >
          Abbrechen
        </button>
        <p className="text-sm font-medium tabular-nums text-primary">
          {formatClock(elapsed)} / {formatClock(MAX_VIDEO_SECONDS)}
        </p>
        <button
          type="button"
          onClick={onPickGallery}
          className="text-sm text-primary"
        >
          Galerie
        </button>
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />
        {recording ? (
          <p className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-red-400">
            Aufnahme
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="px-4 pt-3 text-center text-sm text-red-300">{error}</p>
      ) : null}

      <div className="flex items-center justify-center gap-6 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {recording ? (
          <button
            type="button"
            onClick={() => finishRecording(false)}
            aria-label="Aufnahme beenden"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white"
          >
            <span className="h-6 w-6 rounded-sm bg-red-500" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={!live}
            aria-label="Aufnahme starten"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
          >
            <span className="h-12 w-12 rounded-full bg-red-500" />
          </button>
        )}
      </div>
    </div>
  )
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function formatClock(seconds: number) {
  const whole = Math.min(MAX_VIDEO_SECONDS, Math.floor(seconds))
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
