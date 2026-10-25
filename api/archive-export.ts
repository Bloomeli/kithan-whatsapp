import { Readable } from 'node:stream'
import { Client } from 'basic-ftp'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

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
  req: { method?: string; body?: unknown },
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

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const ticketId = String(body?.ticketId ?? '')
  if (!ticketId) {
    res.status(400).json({ ok: false, error: 'Ticket fehlt.' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const [{ data: ticket, error: ticketError }, { data: messages }, { data: users }] =
    await Promise.all([
      supabase
        .from('tickets')
        .select(
          'id, title, remarks, priority, status, building_label, unit_location, tenant_name, occurred_at, reported_by, insurance_damage, situation, contact, created_at, archived_at',
        )
        .eq('id', ticketId)
        .maybeSingle(),
      supabase
        .from('messages')
        .select('user_id, content, media_url, media_type, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
      supabase.from('users').select('id, name'),
    ])

  if (ticketError || !ticket) {
    res.status(404).json({ ok: false, error: 'Problemraum wurde nicht gefunden.' })
    return
  }

  const names = new Map((users ?? []).map((user) => [user.id, user.name]))
  const report = buildReport(ticket as TicketRow, (messages ?? []) as MessageRow[], names)
  const baseFolderName = ticketFolderName(ticket as TicketRow)

  const client = new Client(25_000)
  let uploaded = 0
  let folderName = baseFolderName

  try {
    await client.access({
      host: FTPS_HOST,
      port: Number.isFinite(FTPS_PORT) ? FTPS_PORT : 21,
      user: FTPS_USER,
      password: FTPS_PASSWORD,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    })
    folderName = await unusedFolderName(client, FTPS_FOLDER, baseFolderName)
    const remoteDir = joinFtpPath(FTPS_FOLDER, folderName)
    await client.ensureDir(remoteDir)
    await client.uploadFrom(Readable.from(Buffer.from(report, 'utf8')), 'Meldung.txt')
    uploaded += 1

    for (const [index, message] of ((messages ?? []) as MessageRow[]).entries()) {
      if (!message.media_url) continue
      const file = await downloadMedia(message.media_url)
      if (!file) continue
      const fileName = mediaFileName(message.media_url, ticket as TicketRow, index + 1, file.extension)
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

  client.close()
  res.status(200).json({ ok: true, folder: folderName, files: uploaded })
}

function buildReport(
  ticket: TicketRow,
  messages: MessageRow[],
  names: Map<string, string>,
) {
  const status = (ticket.status ?? [])
    .map((entry) => STATUS_LABELS[entry] ?? entry)
    .join(', ')
  const lines = [
    `Meldung: ${ticket.title}`,
    `Gebäude: ${ticket.building_label || '—'}`,
    `Bereich: ${ticket.unit_location || '—'}`,
    `Dringlichkeit: ${PRIORITY_LABELS[ticket.priority] ?? ticket.priority}`,
    `Status: ${status || '—'}`,
    `Mieter: ${ticket.tenant_name || '—'}`,
    `Kontakt: ${ticket.contact || '—'}`,
    `Gemeldet von: ${ticket.reported_by || '—'}`,
    `Datum: ${formatDate(ticket.occurred_at || ticket.created_at)}`,
    `Versicherungsschaden: ${ticket.insurance_damage ? 'Ja' : 'Nein'}`,
    `Situation: ${ticket.situation || '—'}`,
    `Sonstiges: ${ticket.remarks || '—'}`,
    '',
    'Chat:',
  ]

  for (const message of messages) {
    const author = names.get(message.user_id) || 'Unbekannt'
    const text = message.content.trim() || (message.media_type === 'video' ? 'Video' : 'Foto')
    lines.push(`${formatDate(message.created_at)}  ${author}: ${text}`)
  }

  return `${lines.join('\n')}\n`
}

function ticketFolderName(ticket: TicketRow) {
  const date = (ticket.archived_at || ticket.created_at || new Date().toISOString()).slice(0, 10)
  const street = safeSegment(ticket.building_label?.split(',')[0] ?? '')
  const title = safeSegment(ticket.title)
  return `${date}_${street}_${title}`.slice(0, 80)
}

async function unusedFolderName(client: Client, base: string, wanted: string) {
  const existing = new Set((await client.list(base)).map((entry) => entry.name))
  if (!existing.has(wanted)) return wanted
  for (let index = 2; index < 100; index += 1) {
    const next = `${wanted}_${index}`
    if (!existing.has(next)) return next
  }
  return `${wanted}_${Date.now()}`
}

function mediaFileName(url: string, ticket: TicketRow, sequence: number, extension: string) {
  const fromUrl = url.split('/').pop()?.split('?')[0] ?? ''
  const cleaned = fromUrl.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
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
    transliterated
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9._-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 48) || 'Meldung'
  )
}

function joinFtpPath(base: string, child: string) {
  return `${base.replace(/\/+$/, '')}/${child.replace(/^\/+/, '')}`
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
