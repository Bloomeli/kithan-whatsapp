const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ ok: false, error: 'Supabase ist auf Vercel nicht konfiguriert.' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const ticketId = String(body?.ticketId ?? '')
  const extension = String(body?.extension ?? 'bin').replace(/[^a-z0-9]/gi, '')
  const contentType = String(body?.contentType ?? 'application/octet-stream')
  const data = String(body?.data ?? '')

  if (!ticketId || !data) {
    res.status(400).json({ ok: false, error: 'Datei fehlt.' })
    return
  }

  const fileBytes = Buffer.from(data, 'base64')
  if (fileBytes.length > 4_000_000) {
    res.status(413).json({ ok: false, error: 'Datei ist zu groß.' })
    return
  }

  const path = `${ticketId}/${crypto.randomUUID()}.${extension || 'bin'}`
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/chat-media/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: fileBytes,
  })

  if (!response.ok) {
    const detail = await response.text()
    res.status(500).json({
      ok: false,
      error: detail.slice(0, 180) || `HTTP ${response.status}`,
    })
    return
  }

  res.status(200).json({
    ok: true,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/chat-media/${path}`,
  })
}
