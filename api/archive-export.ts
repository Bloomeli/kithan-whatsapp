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
  const reportPdf = await buildReportPdf(ticket, messages, names)
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

    for (const [index, message] of messages.entries()) {
      if (!message.media_url) continue
      const file = await downloadMedia(message.media_url)
      if (!file) {
        throw new Error('Ein Foto oder Video konnte nicht vollständig übertragen werden.')
      }
      const fileName = mediaFileName(message.media_url, ticket, index + 1, file.extension)
      await client.uploadFrom(Readable.from(file.bytes), fileName)
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
) {
  const status = (ticket.status ?? [])
    .map((entry) => STATUS_LABELS[entry] ?? entry)
    .join(', ')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const pageSize: [number, number] = [595.28, 841.89]
  const margin = 50
  const maxWidth = pageSize[0] - margin * 2
  let page = doc.addPage(pageSize)
  let y = pageSize[1] - margin

  const ensureSpace = (needed: number) => {
    if (y - needed >= margin) return
    page = doc.addPage(pageSize)
    y = pageSize[1] - margin
  }

  const write = (text: string, used: PDFFont, size: number, extraGap = 4) => {
    const lines = wrapPdfText(pdfSafe(text), used, size, maxWidth)
    for (const line of lines) {
      ensureSpace(size + extraGap)
      page.drawText(line, {
        x: margin,
        y: y - size,
        size,
        font: used,
        color: rgb(0.12, 0.12, 0.12),
      })
      y -= size + extraGap
    }
  }

  write('Kithan Problemraum', fontBold, 16, 8)
  write(ticket.title || 'Meldung', fontBold, 13, 14)

  const fields: Array<[string, string]> = [
    ['Gebäude', ticket.building_label || '-'],
    ['Bereich', ticket.unit_location || '-'],
    ['Dringlichkeit', PRIORITY_LABELS[ticket.priority] ?? ticket.priority],
    ['Status', status || '-'],
    ['Mieter', ticket.tenant_name || '-'],
    ['Kontakt', ticket.contact || '-'],
    ['Gemeldet von', ticket.reported_by || '-'],
    ['Datum', formatDate(ticket.occurred_at || ticket.created_at)],
    ['Versicherungsschaden', ticket.insurance_damage ? 'Ja' : 'Nein'],
    ['Situation', ticket.situation || '-'],
    ['Sonstiges', ticket.remarks || '-'],
  ]

  for (const [label, value] of fields) {
    write(`${label}: ${value}`, font, 11, 5)
  }

  y -= 8
  write('Chat', fontBold, 13, 8)

  if (messages.length === 0) {
    write('Keine Nachrichten.', font, 11, 5)
  } else {
    for (const message of messages) {
      const author = names.get(message.user_id) || 'Unbekannt'
      const text =
        message.content.trim() ||
        (message.media_type === 'video' ? 'Video' : message.media_type === 'image' ? 'Foto' : 'Nachricht')
      write(`${formatDate(message.created_at)}  ${author}: ${text}`, font, 11, 5)
    }
  }

  const pages = doc.getPages()
  pages.forEach((entry: PDFPage, index: number) => {
    entry.drawText(`${index + 1} / ${pages.length}`, {
      x: pageSize[0] - margin - 40,
      y: 24,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
  })

  return Buffer.from(await doc.save())
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
