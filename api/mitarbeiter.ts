const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

function supabaseHost() {
  try {
    return new URL(SUPABASE_URL).host
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
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=id,name,created_at&order=name.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    )
    const body = await response.text()
    if (!response.ok) {
      res.status(500).json({
        ok: false,
        error: `${supabaseHost()} · ${body.slice(0, 160) || `HTTP ${response.status}`}`,
      })
      return
    }
    res.status(200).json({ ok: true, users: JSON.parse(body) })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: `${supabaseHost()} · ${error instanceof Error ? error.message : 'Fetch fehlgeschlagen'}`,
    })
  }
}
