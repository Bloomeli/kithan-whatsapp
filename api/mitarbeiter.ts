const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
const SUPABASE_ANON_KEY = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim()

function usersUrl() {
  const base = new URL(SUPABASE_URL)
  const prefix = base.pathname.replace(/\/$/, '')
  const path = prefix.endsWith('/rest/v1') ? `${prefix}/users` : '/rest/v1/users'
  const url = new URL(path, `${base.origin}/`)
  url.searchParams.set('select', 'id,name,created_at')
  url.searchParams.set('order', 'name.asc')
  return url
}

function urlHint() {
  try {
    const url = usersUrl()
    return `${url.host}${url.pathname}`
  } catch {
    return 'ungueltige-url'
  }
}

export default async function handler(
  req: { method?: string },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({
      ok: false,
      error: 'Supabase ist auf Vercel nicht konfiguriert.',
    })
    return
  }

  try {
    const response = await fetch(usersUrl(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    })
    const body = await response.text()
    if (!response.ok) {
      res.status(500).json({
        ok: false,
        error: `${urlHint()} · ${body.slice(0, 160) || `HTTP ${response.status}`}`,
      })
      return
    }
    res.status(200).json({ ok: true, users: JSON.parse(body) })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: `${urlHint()} · ${error instanceof Error ? error.message : 'Fetch fehlgeschlagen'}`,
    })
  }
}
