const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

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
      error: body.slice(0, 200) || `HTTP ${response.status}`,
    })
    return
  }

  try {
    res.status(200).json({ ok: true, users: JSON.parse(body) })
  } catch {
    res.status(500).json({ ok: false, error: 'Ungültige Antwort von Supabase.' })
  }
}
