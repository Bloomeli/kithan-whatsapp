import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'
import { CHAT_MEDIA_BUCKET, type MediaType } from '../types'

const MAX_IMAGE_EDGE = 1920
const IMAGE_QUALITY = 0.8
const MAX_VIDEO_EDGE = 720
export const MAX_VIDEO_SECONDS = 30
export const VIDEO_BITRATE = 900_000
const MAX_VIDEO_PASSTHROUGH_BYTES = 3.2 * 1024 * 1024
const VIDEO_DURATION_EPSILON = 0.05

export async function isVideoOverTimeLimit(file: File): Promise<boolean> {
  const duration = await readVideoDuration(file)
  return isDurationOverLimit(duration)
}

export async function prepareChatMedia(file: File): Promise<{
  file: File
  mediaType: MediaType
}> {
  if (file.type.startsWith('image/')) {
    return { file: await compressImage(file), mediaType: 'image' }
  }

  if (file.type.startsWith('video/')) {
    return { file: await compressVideo(file), mediaType: 'video' }
  }

  throw new Error('Nur Fotos und Videos können hochgeladen werden.')
}

export async function uploadChatMedia(ticketId: string, file: File): Promise<string> {
  const extension = extensionFromFile(file)
  const path = `${ticketId}/${crypto.randomUUID()}.${extension}`

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return uploadViaVercel(ticketId, file, extension)
  }

  const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })

  if (error) {
    throw new Error(
      `Datei konnte nicht in den Speicher geladen werden. ${error.message}`,
    )
  }

  const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function uploadViaVercel(ticketId: string, file: File, extension: string) {
  const data = await fileToBase64(file)
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticketId,
      extension,
      contentType: file.type || 'application/octet-stream',
      data,
    }),
  })
  const payload = (await response.json()) as { ok?: boolean; publicUrl?: string; error?: string }
  if (!response.ok || !payload.ok || !payload.publicUrl) {
    throw new Error(
      payload.error
        ? `Datei konnte nicht hochgeladen werden. ${payload.error}`
        : 'Datei konnte nicht hochgeladen werden. Sie bleibt lokal gespeichert. Bitte später erneut versuchen.',
    )
  }
  return payload.publicUrl
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Datei konnte lokal nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

async function compressImage(file: File): Promise<File> {
  const fileType = canvasSupportsWebp() ? 'image/webp' : 'image/jpeg'

  const compressed = await imageCompression(file, {
    maxWidthOrHeight: MAX_IMAGE_EDGE,
    initialQuality: IMAGE_QUALITY,
    maxSizeMB: 1.2,
    fileType,
    useWebWorker: true,
  })

  return new File([compressed], renameExtension(file.name, fileType), {
    type: fileType,
    lastModified: Date.now(),
  })
}

async function compressVideo(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = objectUrl
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'

  try {
    await waitForVideoMetadata(video)
    const overLimit = isDurationOverLimit(video.duration)

    const sourceEdge = Math.max(video.videoWidth, video.videoHeight)
    const alreadyHd =
      sourceEdge <= MAX_VIDEO_EDGE && file.size <= MAX_VIDEO_PASSTHROUGH_BYTES

    if (alreadyHd && !overLimit) {
      return file
    }

    const scale = Math.min(1, MAX_VIDEO_EDGE / Math.max(sourceEdge, 1))
    const width = even(Math.round(video.videoWidth * scale)) || 2
    const height = even(Math.round(video.videoHeight * scale)) || 2

    const recorded = await recordScaledVideo(video, width, height)
    if (overLimit) return recorded
    return recorded.size < file.size ? recorded : file
  } finally {
    URL.revokeObjectURL(objectUrl)
    video.removeAttribute('src')
    video.load()
  }
}

async function recordScaledVideo(
  video: HTMLVideoElement,
  width: number,
  height: number,
): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Video konnte nicht verarbeitet werden.')
  }

  const videoStream = canvas.captureStream(30)
  const audioTrack = await captureVideoAudio(video)
  const tracks = [
    ...videoStream.getVideoTracks(),
    ...(audioTrack ? [audioTrack] : []),
  ]
  const stream = new MediaStream(tracks)
  const mimeType = pickChatRecorderMime()

  const chunks: BlobPart[] = []
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITRATE,
  })

  const finished = new Promise<File>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onerror = () => reject(new Error('Video-Komprimierung ist fehlgeschlagen.'))
    recorder.onstop = () => {
      audioTrack?.stop()
      videoStream.getTracks().forEach((track) => track.stop())
      const blob = new Blob(chunks, { type: mimeType })
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
      resolve(
        new File([blob], `video.${extension}`, {
          type: mimeType,
          lastModified: Date.now(),
        }),
      )
    }
  })

  video.currentTime = 0
  await waitForEvent(video, 'seeked')
  recorder.start(250)

  const draw = () => {
    if (video.paused || video.ended) return
    context.drawImage(video, 0, 0, width, height)
    requestAnimationFrame(draw)
  }

  await video.play()
  draw()
  await Promise.race([
    waitForEvent(video, 'ended'),
    waitForTimeout(MAX_VIDEO_SECONDS * 1000),
  ])
  if (!video.paused && !video.ended) video.pause()
  if (recorder.state !== 'inactive') recorder.stop()
  return finished
}

async function captureVideoAudio(video: HTMLVideoElement): Promise<MediaStreamTrack | null> {
  try {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaElementSource(video)
    const destination = audioContext.createMediaStreamDestination()
    source.connect(destination)
    return destination.stream.getAudioTracks()[0] ?? null
  } catch {
    return null
  }
}

export function pickChatRecorderMime() {
  const candidates = [
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm'
}

function canvasSupportsWebp() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').startsWith('data:image/webp')
}

function isDurationOverLimit(duration: number) {
  return Number.isFinite(duration) && duration > MAX_VIDEO_SECONDS + VIDEO_DURATION_EPSILON
}

async function readVideoDuration(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = objectUrl

  try {
    await waitForVideoMetadata(video)
    return video.duration
  } finally {
    URL.revokeObjectURL(objectUrl)
    video.removeAttribute('src')
    video.load()
  }
}

function waitForTimeout(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  if (video.readyState >= 1) return Promise.resolve()
  return waitForEvent(video, 'loadedmetadata')
}

function waitForEvent(target: EventTarget, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      target.removeEventListener('error', onError)
      resolve()
    }
    const onError = () => {
      target.removeEventListener(eventName, onSuccess)
      reject(new Error('Medium konnte nicht gelesen werden.'))
    }
    target.addEventListener(eventName, onSuccess, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}

function even(value: number) {
  return value % 2 === 0 ? value : value - 1
}

function extensionFromFile(file: File) {
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type.includes('mp4')) return 'mp4'
  if (file.type.includes('webm')) return 'webm'
  const fromName = file.name.split('.').pop()?.toLowerCase()
  return fromName && fromName.length <= 5 ? fromName : 'bin'
}

function renameExtension(name: string, mime: string) {
  const base = name.replace(/\.[^.]+$/, '') || 'foto'
  if (mime === 'image/webp') return `${base}.webp`
  if (mime === 'image/jpeg') return `${base}.jpg`
  return name
}
