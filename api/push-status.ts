import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '')
  .trim()
  .replace(/^["']|["']$/g, '')

export default async function handler(
  req: { method?: string; query?: { userId?: string } },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ ok: false, error: 'Method not allowed' })
      return
    }

    const userId = String(req.query?.userId ?? '')
    let table: 'ok' | 'missing' | 'error' = 'ok'
    let tableError = ''
    let saved = 0

    if (VAPID_PRIVATE_KEY && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const { data, error } = await createClient(new URL(SUPABASE_URL).origin, SUPABASE_ANON_KEY)
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId || '00000000-0000-0000-0000-000000000000')

      if (error) {
        table = error.message.includes('does not exist') ? 'missing' : 'error'
        tableError = error.message
      } else {
        saved = data?.length ?? 0
      }
    }

    res.status(200).json({
      ok: true,
      hasPrivateKey: Boolean(VAPID_PRIVATE_KEY),
      table,
      tableError,
      saved,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Status konnte nicht geladen werden.',
    })
  }
}
