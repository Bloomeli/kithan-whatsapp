import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase
    .from('users')
    .select('id, name, created_at')
    .order('name', { ascending: true })

  if (error) {
    res.status(500).json({ ok: false, error: error.message })
    return
  }

  res.status(200).json({ ok: true, users: data ?? [] })
}
