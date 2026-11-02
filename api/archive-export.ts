import { Readable } from 'node:stream'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { Client } from 'basic-ftp'

export const maxDuration = 60

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '')
  .trim()
  .replace(/\/$/, '')
const SUPABASE_ANON_KEY = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim()
const TICKET_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TICKET_SELECT =
  'id,title,remarks,priority,status,building_label,unit_location,tenant_name,occurred_at,reported_by,insurance_damage,situation,contact,created_at,archived_at'

const FTPS_HOST = (process.env.COMPANY_FTPS_HOST || '').trim()
const FTPS_PORT = Number(process.env.COMPANY_FTPS_PORT || 21)
const FTPS_USER = (process.env.COMPANY_FTPS_USER || '').trim()
const FTPS_PASSWORD = (process.env.COMPANY_FTPS_PASSWORD || '').trim()
const FTPS_FOLDER = (
  process.env.COMPANY_FTPS_FOLDER || '/KithanVermietung/Kithan WhatsApp'
).trim()

const PRIORITY_LABELS: Record<string, string> = {
  emergency: 'Notfall / Alarm',
  urgent: 'Dringend',
  standard: 'Kann warten',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  under_review: 'Wird geprüft',
  in_progress: 'In Bearbeitung',
  needs_consultation: 'Benötige Rücksprache',
  waiting: 'Wartet',
  waiting_for_tenant: 'Warten auf Mieter',
  waiting_for_parts: 'Warten auf Teile',
  done: 'Wird erledigt',
  completed: 'Erledigt',
}

type TicketRow = {
  id: string
  title: string
  remarks: string | null
  priority: string
  status: string[]
  building_label: string | null
  unit_location: string | null
  tenant_name: string | null
  occurred_at: string | null
  reported_by: string | null
  insurance_damage: boolean
  situation: string | null
  contact: string | null
  created_at: string
  archived_at: string | null
}

type MessageRow = {
  user_id: string
  content: string
  media_url: string | null
  media_type: string | null
  created_at: string
}

type ExportedMedia = {
  bytes: Buffer
  extension: string
  fileName: string
  kind: 'image' | 'video'
  createdAt: string
  caption: string
}

export default async function handler(
  req: {
    method?: string
    body?: unknown
    url?: string
    query?: Record<string, string | string[] | undefined>
  },
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!FTPS_HOST || !FTPS_USER || !FTPS_PASSWORD) {
    res.status(500).json({
      ok: false,
      error: 'Firmenserver ist auf Vercel noch nicht eingetragen.',
    })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ ok: false, error: 'Supabase ist auf Vercel nicht konfiguriert.' })
    return
  }

  const ticketId = readTicketId(req)
  if (!TICKET_ID_RE.test(ticketId)) {
    res.status(400).json({ ok: false, error: 'Ticket fehlt.' })
    return
  }

  const [ticketResult, messageResult, userResult] = await Promise.all([
    restGet<TicketRow[]>('tickets', {
      select: TICKET_SELECT,
      id: `eq.${ticketId}`,
      limit: '1',
    }),
    restGet<MessageRow[]>('messages', {
      select: 'user_id,content,media_url,media_type,created_at',
      ticket_id: `eq.${ticketId}`,
      order: 'created_at.asc',
    }),
    restGet<{ id: string; name: string }[]>('users', { select: 'id,name' }),
  ])

  if (ticketResult.error) {
    res.status(500).json({
      ok: false,
      error: `Problemraum konnte nicht geladen werden. ${ticketResult.error}`,
    })
    return
  }
  const ticket = ticketResult.data?.[0]
  if (!ticket) {
    res.status(404).json({ ok: false, error: 'Problemraum wurde nicht gefunden.' })
    return
  }

  const messages = messageResult.data ?? []
  const names = new Map((userResult.data ?? []).map((user) => [user.id, user.name]))
  const media: ExportedMedia[] = []
  for (const [index, message] of messages.entries()) {
    if (!message.media_url) continue
    const file = await downloadMedia(message.media_url)
    if (!file) {
      res.status(502).json({
        ok: false,
        error: 'Ein Foto oder Video konnte nicht vollständig übertragen werden.',
      })
      return
    }
    media.push({
      bytes: file.bytes,
      extension: file.extension,
      fileName: mediaFileName(message.media_url, ticket, index + 1, file.extension),
      kind:
        message.media_type === 'video' || file.extension === 'mp4' || file.extension === 'webm'
          ? 'video'
          : 'image',
      createdAt: message.created_at,
      caption: message.content.trim(),
    })
  }

  const reportPdf = await buildReportPdf(ticket, messages, names, media)
  const baseFolderName = ticketFolderName(ticket)

  const client = new Client(25_000)
  let uploaded = 0
  let folderName: string

  try {
    await client.access({
      host: FTPS_HOST,
      port: Number.isFinite(FTPS_PORT) ? FTPS_PORT : 21,
      user: FTPS_USER,
      password: FTPS_PASSWORD,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    })
    await enterFtpDir(client, FTPS_FOLDER)
    folderName = await unusedFolderName(client, baseFolderName)
    await client.ensureDir(`${FTPS_FOLDER.replace(/\/+$/, '')}/${folderName}`)
    await client.uploadFrom(Readable.from(reportPdf), 'Meldung.pdf')
    uploaded += 1

    const photos = media.filter((entry) => entry.kind === 'image')
    const videos = media.filter((entry) => entry.kind === 'video')
    for (const file of [...photos, ...videos]) {
      await client.uploadFrom(Readable.from(file.bytes), file.fileName)
      uploaded += 1
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    res.status(502).json({
      ok: false,
      error: `Firmenserver: ${message}`,
    })
    client.close()
    return
  }

  const exportedAt = new Date().toISOString()
  const stampError = await restPatch(
    'tickets',
    { id: `eq.${ticketId}` },
    { exported_at: exportedAt },
  )

  client.close()

  if (stampError) {
    res.status(500).json({
      ok: false,
      error: 'Upload geklappt, aber der Zeitpunkt konnte nicht gespeichert werden.',
    })
    return
  }

  res.status(200).json({ ok: true, folder: folderName, files: uploaded, exported_at: exportedAt })
}

async function buildReportPdf(
  ticket: TicketRow,
  messages: MessageRow[],
  names: Map<string, string>,
  media: ExportedMedia[],
) {
  const status = (ticket.status ?? [])
    .map((entry) => STATUS_LABELS[entry] ?? entry)
    .join(', ')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const pageSize: [number, number] = [595.28, 841.89]
  const margin = 40
  const boxWidth = pageSize[0] - margin * 2
  const footer = 34
  const ink = rgb(0.1, 0.1, 0.1)
  const muted = rgb(0.32, 0.32, 0.32)
  const line = rgb(0.78, 0.78, 0.78)
  const headerFill = rgb(0.12, 0.12, 0.12)
  const boxFill = rgb(1, 1, 1)
  let page = doc.addPage(pageSize)
  let y = pageSize[1] - 32

  const addPage = () => {
    page = doc.addPage(pageSize)
    y = pageSize[1] - 32
  }

  const ensure = (needed: number) => {
    if (y - needed < footer) addPage()
  }

  const drawBoxFrame = (top: number, height: number) => {
    page.drawRectangle({
      x: margin,
      y: top - height,
      width: boxWidth,
      height,
      borderColor: ink,
      borderWidth: 1.2,
      color: boxFill,
    })
  }

  const drawBoxTitle = (top: number, title: string) => {
    page.drawRectangle({
      x: margin,
      y: top - 26,
      width: boxWidth,
      height: 26,
      color: headerFill,
    })
    page.drawText(pdfSafe(title), {
      x: margin + 10,
      y: top - 18,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    })
  }

  const drawHeader = () => {
    const height = 58
    ensure(height + 12)
    const top = y
    drawBoxFrame(top, height)
    page.drawRectangle({
      x: margin,
      y: top - height,
      width: 8,
      height,
      color: rgb(0.1, 0.42, 1),
    })
    page.drawText('Kithan Problemraum', {
      x: margin + 20,
      y: top - 22,
      size: 10,
      font: fontBold,
      color: muted,
    })
    const titleLines = wrapPdfText(pdfSafe(ticket.title || 'Meldung'), fontBold, 16, boxWidth - 36)
    page.drawText(titleLines[0] ?? 'Meldung', {
      x: margin + 20,
      y: top - 44,
      size: 16,
      font: fontBold,
      color: ink,
    })
    y = top - height - 14
  }

  const drawFieldBox = (title: string, rows: Array<[string, string]>) => {
    const labelWidth = 148
    const valueWidth = boxWidth - labelWidth - 28
    const prepared = rows.map(([label, value]) => ({
      label: pdfSafe(label),
      lines: wrapPdfText(pdfSafe(value || '-'), font, 11, valueWidth),
    }))
    const body = prepared.reduce((sum, row) => sum + Math.max(20, row.lines.length * 14) + 8, 0)
    const height = 26 + body + 10
    ensure(Math.min(height, 240))
    if (y - height < footer) addPage()
    const top = y
    drawBoxFrame(top, height)
    drawBoxTitle(top, title)
    let cursor = top - 36
    for (const [index, row] of prepared.entries()) {
      const rowHeight = Math.max(20, row.lines.length * 14)
      if (index > 0) {
        page.drawLine({
          start: { x: margin + 10, y: cursor + 6 },
          end: { x: margin + boxWidth - 10, y: cursor + 6 },
          thickness: 0.6,
          color: line,
        })
      }
      page.drawText(row.label, {
        x: margin + 12,
        y: cursor - 12,
        size: 9,
        font: fontBold,
        color: muted,
      })
      for (const [lineIndex, text] of row.lines.entries()) {
        page.drawText(text, {
          x: margin + 12 + labelWidth,
          y: cursor - 12 - lineIndex * 14,
          size: 11,
          font,
          color: ink,
        })
      }
      cursor -= rowHeight + 8
    }
    y = top - height - 12
  }

  const drawTextBox = (title: string, paragraphs: string[]) => {
    const innerWidth = boxWidth - 24
    const lines = paragraphs.flatMap((paragraph) =>
      wrapPdfText(pdfSafe(paragraph || '-'), font, 11, innerWidth),
    )
    const chunks: string[][] = []
    let current: string[] = []
    let used = 0
    const pushChunk = () => {
      if (current.length === 0) return
      chunks.push(current)
      current = []
      used = 0
    }
    for (const text of lines) {
      const lineH = 15
      const available = y - footer - 40
      const limit = chunks.length === 0 && current.length === 0
        ? Math.max(80, available)
        : pageSize[1] - 32 - footer - 40
      if (used + lineH > limit && current.length > 0) pushChunk()
      current.push(text)
      used += lineH
    }
    pushChunk()
    if (chunks.length === 0) chunks.push(['-'])

    for (const [chunkIndex, chunk] of chunks.entries()) {
      const height = 26 + chunk.length * 15 + 16
      ensure(height)
      const top = y
      drawBoxFrame(top, height)
      drawBoxTitle(top, chunkIndex === 0 ? title : `${title} (Fortsetzung)`)
      let cursor = top - 42
      for (const text of chunk) {
        page.drawText(text, {
          x: margin + 12,
          y: cursor,
          size: 11,
          font,
          color: ink,
        })
        cursor -= 15
      }
      y = top - height - 12
    }
  }

  const drawMediaBox = async (entry: ExportedMedia, index: number) => {
    const heading = entry.kind === 'video' ? `Video ${index}` : `Foto ${index}`
    const caption = entry.caption || (entry.kind === 'video' ? entry.fileName : formatDate(entry.createdAt))
    const captionLines = wrapPdfText(
      pdfSafe(`${formatDate(entry.createdAt)}  ${caption}`),
      font,
      10,
      boxWidth - 24,
    )

    if (entry.kind === 'video') {
      const height = 26 + 48 + captionLines.length * 13
      ensure(height)
      const top = y
      drawBoxFrame(top, height)
      drawBoxTitle(top, heading)
      page.drawText(pdfSafe(entry.fileName), {
        x: margin + 12,
        y: top - 44,
        size: 11,
        font: fontBold,
        color: ink,
      })
      page.drawText('Videodatei liegt im gleichen Ordner.', {
        x: margin + 12,
        y: top - 60,
        size: 10,
        font,
        color: muted,
      })
      y = top - height - 12
      return
    }

    const image = await embedPdfImage(doc, entry.bytes, entry.extension)
    if (!image) {
      const height = 26 + 40 + captionLines.length * 13
      ensure(height)
      const top = y
      drawBoxFrame(top, height)
      drawBoxTitle(top, heading)
      page.drawText('Foto liegt als Datei im gleichen Ordner.', {
        x: margin + 12,
        y: top - 46,
        size: 11,
        font,
        color: muted,
      })
      y = top - height - 12
      return
    }

    const maxW = boxWidth - 24
    const maxH = 320
    const scale = Math.min(maxW / image.width, maxH / image.height, 1)
    const drawW = image.width * scale
    const drawH = image.height * scale
    const height = 26 + 16 + drawH + captionLines.length * 13 + 14
    ensure(Math.min(height, 200))
    if (y - height < footer) addPage()
    const top = y
    drawBoxFrame(top, height)
    drawBoxTitle(top, heading)
    page.drawImage(image, {
      x: margin + 12,
      y: top - 26 - 10 - drawH,
      width: drawW,
      height: drawH,
    })
    let cursor = top - 26 - 16 - drawH - 12
    for (const text of captionLines) {
      page.drawText(text, {
        x: margin + 12,
        y: cursor,
        size: 10,
        font,
        color: muted,
      })
      cursor -= 13
    }
    y = top - height - 12
  }

  drawHeader()
  drawFieldBox('Meldung', [
    ['Gebäude', ticket.building_label || '-'],
    ['Bereich', ticket.unit_location || '-'],
    ['Dringlichkeit', PRIORITY_LABELS[ticket.priority] ?? ticket.priority],
    ['Status', status || '-'],
    ['Mieter', ticket.tenant_name || '-'],
    ['Kontakt', ticket.contact || '-'],
    ['Gemeldet von', ticket.reported_by || '-'],
    ['Datum', formatDate(ticket.occurred_at || ticket.created_at)],
    ['Versicherungsschaden', ticket.insurance_damage ? 'Ja' : 'Nein'],
    ['Sonstiges', ticket.remarks || '-'],
  ])
  drawTextBox('Situation', [ticket.situation || 'Keine Angabe'])

  const chatLines =
    messages.length === 0
      ? ['Keine Nachrichten.']
      : messages.map((message) => {
          const author = names.get(message.user_id) || 'Unbekannt'
          const text =
            message.content.trim() ||
            (message.media_type === 'video'
              ? 'Video (siehe Anhang)'
              : message.media_type === 'image'
                ? 'Foto (siehe Anhang)'
                : 'Nachricht')
          return `${formatDate(message.created_at)}  ${author}: ${text}`
        })
  drawTextBox('Chat', chatLines)

  const photos = media.filter((entry) => entry.kind === 'image')
  const videos = media.filter((entry) => entry.kind === 'video')
  if (photos.length === 0 && videos.length === 0) {
    drawTextBox('Fotos und Videos', ['Keine Fotos oder Videos.'])
  } else {
    let photoIndex = 1
    for (const entry of photos) {
      await drawMediaBox(entry, photoIndex)
      photoIndex += 1
    }
    let videoIndex = 1
    for (const entry of videos) {
      await drawMediaBox(entry, videoIndex)
      videoIndex += 1
    }
  }

  const pages = doc.getPages()
  pages.forEach((entry: PDFPage, index: number) => {
    entry.drawText(`${index + 1} / ${pages.length}`, {
      x: pageSize[0] - margin - 36,
      y: 16,
      size: 9,
      font,
      color: muted,
    })
  })

  return Buffer.from(await doc.save())
}

async function embedPdfImage(doc: PDFDocument, bytes: Buffer, extension: string) {
  const raw = new Uint8Array(bytes)
  const tryJpg = async () => {
    try {
      return await doc.embedJpg(raw)
    } catch {
      return null
    }
  }
  const tryPng = async () => {
    try {
      return await doc.embedPng(raw)
    } catch {
      return null
    }
  }
  if (extension === 'png') return (await tryPng()) ?? (await tryJpg())
  return (await tryJpg()) ?? (await tryPng())
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['-']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word
      continue
    }
    let chunk = ''
    for (const char of word) {
      const trial = `${chunk}${char}`
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        chunk = trial
      } else {
        if (chunk) lines.push(chunk)
        chunk = char
      }
    }
    current = chunk
  }
  if (current) lines.push(current)
  return lines
}

function pdfSafe(value: string) {
  return [...value]
    .map((char) => {
      if (char === '—' || char === '–') return '-'
      if (char === '„' || char === '“' || char === '”') return '"'
      if (char === '‘' || char === '’') return "'"
      const code = char.charCodeAt(0)
      if (code === 10 || code === 13) return ' '
      if (code < 32) return ''
      if (code <= 126 || 'äöüÄÖÜß'.includes(char)) return char
      if (code <= 255) return char
      return '?'
    })
    .join('')
}

function ticketFolderName(ticket: TicketRow) {
  const date = (ticket.archived_at || ticket.created_at || new Date().toISOString()).slice(0, 10)
  const street = safeSegment(ticket.building_label?.split(',')[0] ?? '')
  const title = safeSegment(ticket.title)
  return `${date}_${street}_${title}`.slice(0, 80)
}

async function unusedFolderName(client: Client, wanted: string) {
  const existing = new Set((await client.list()).map((entry) => entry.name))
  if (!existing.has(wanted)) return wanted
  for (let index = 2; index < 100; index += 1) {
    const next = `${wanted}_${index}`
    if (!existing.has(next)) return next
  }
  return `${wanted}_${Date.now()}`
}

async function enterFtpDir(client: Client, path: string) {
  await client.cd('/')
  for (const part of path.split('/').filter(Boolean)) {
    await client.cd(part)
  }
}

function mediaFileName(url: string, ticket: TicketRow, sequence: number, extension: string) {
  const fromUrl = url.split('/').pop()?.split('?')[0] ?? ''
  const cleaned = stripUnsafeName(fromUrl)
  if (cleaned && cleaned !== '.' && cleaned !== '..') return cleaned.slice(0, 120)
  const n = String(sequence).padStart(3, '0')
  return `${safeSegment(ticket.title)}_${n}.${extension}`
}

async function downloadMedia(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0) return null
    const type = response.headers.get('content-type') ?? ''
    const extension =
      type.includes('jpeg') ? 'jpg'
      : type.includes('png') ? 'png'
      : type.includes('webp') ? 'webp'
      : type.includes('mp4') ? 'mp4'
      : type.includes('webm') ? 'webm'
      : (url.split('.').pop()?.toLowerCase() || 'bin')
    return { bytes, extension }
  } catch {
    return null
  }
}

function safeSegment(value: string) {
  const transliterated = value
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
  return (
    stripUnsafeName(transliterated)
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9._-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 48) || 'Meldung'
  )
}

function stripUnsafeName(value: string) {
  return [...value]
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && !'<>:"/\\|?*'.includes(char)
    })
    .join('')
}

function readTicketId(req: {
  body?: unknown
  url?: string
  query?: Record<string, string | string[] | undefined>
}) {
  const fromQuery = req.query?.ticketId
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery.trim()
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string' && fromQuery[0]) {
    return fromQuery[0].trim()
  }

  if (req.url && req.url.includes('ticketId=')) {
    const search = new URL(req.url, 'https://n.local').searchParams.get('ticketId')
    if (search) return search.trim()
  }

  let body = req.body
  if (typeof body === 'string' && body) {
    try {
      body = JSON.parse(body) as unknown
    } catch {
      body = null
    }
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const value = (body as { ticketId?: unknown }).ticketId
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function restUrl(table: string) {
  const base = new URL(SUPABASE_URL)
  const prefix = base.pathname.replace(/\/$/, '')
  const restBase = prefix.endsWith('/rest/v1') ? prefix : '/rest/v1'
  return new URL(`${restBase}/${table}`, `${base.origin}/`)
}

async function restGet<T>(
  table: string,
  params: Record<string, string>,
): Promise<{ data: T | null; error: string | null }> {
  const url = restUrl(table)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  })
  const text = await response.text()
  if (!response.ok) {
    return { data: null, error: restErrorMessage(text, response.status) }
  }
  try {
    return { data: JSON.parse(text) as T, error: null }
  } catch {
    return { data: null, error: 'Antwort von Supabase war ungültig.' }
  }
}

async function restPatch(
  table: string,
  filter: Record<string, string>,
  body: unknown,
) {
  const url = restUrl(table)
  for (const [key, value] of Object.entries(filter)) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (response.ok) return null
  return restErrorMessage(await response.text(), response.status)
}

function restErrorMessage(text: string, status: number) {
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string }
    return parsed.message || parsed.error || `HTTP ${status}`
  } catch {
    return text.slice(0, 160) || `HTTP ${status}`
  }
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
