import { pushConfigured, supabaseAdmin, VAPID_PRIVATE_KEY } from './push-shared'

export default async function handler(
  req: { method?: string; query?: { userId?: string } },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const userId = String(req.query?.userId ?? '')
  let table: 'ok' | 'missing' | 'error' = 'ok'
  let tableError = ''
  let saved = 0

  if (pushConfigured()) {
    const { data, error } = await supabaseAdmin()
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
}
