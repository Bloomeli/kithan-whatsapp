import { pushConfigured, sendPushToUsers, supabaseAdmin } from './push-shared'

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  try {
    await handleNotify(req, res)
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Push ist fehlgeschlagen.',
    })
  }
}

async function handleNotify(
  req: { method?: string; body?: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!pushConfigured()) {
    res.status(500).json({
      ok: false,
      error: 'Push ist nicht konfiguriert (VAPID_PRIVATE_KEY).',
    })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

  if (body?.test && body?.userId) {
    const result = await sendPushToUsers([String(body.userId)], {
      title: 'Kithan',
      body: 'Test: Mitteilungen funktionieren.',
      tag: 'kithan-test',
      url: '/',
      unread: 1,
    })
    res.status(result.error && result.sent === 0 ? 500 : 200).json({
      ok: result.sent > 0,
      sent: result.sent,
      error: result.error,
    })
    return
  }

  const ticketId = String(body?.ticketId ?? '')
  const senderId = String(body?.senderId ?? '')
  const title = String(body?.title ?? 'Kithan')
  const text = String(body?.body ?? 'Neue Nachricht')
  const url = String(body?.url ?? '/')

  if (!ticketId || !senderId) {
    res.status(400).json({ ok: false, error: 'ticketId und senderId fehlen.' })
    return
  }

  const supabase = supabaseAdmin()
  const [{ data: members, error: memberError }, { data: ticket }] = await Promise.all([
    supabase.from('ticket_members').select('user_id').eq('ticket_id', ticketId),
    supabase.from('tickets').select('created_by').eq('id', ticketId).maybeSingle(),
  ])

  if (memberError) {
    res.status(500).json({ ok: false, error: 'Mitglieder konnten nicht geladen werden.' })
    return
  }

  const recipientIds = [
    ...new Set(
      [
        ...(members ?? []).map((row) => row.user_id as string),
        ticket?.created_by as string | undefined,
      ].filter((id): id is string => Boolean(id) && id !== senderId),
    ),
  ]

  const result = await sendPushToUsers(recipientIds, {
    title,
    body: text,
    tag: ticketId,
    url,
    unread: 1,
  })

  res.status(result.error && result.sent === 0 ? 500 : 200).json({
    ok: result.sent > 0,
    sent: result.sent,
    error: result.error,
  })
}
