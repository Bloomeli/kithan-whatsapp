import { sendPushToUsers } from './push-shared'

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

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const userId = String(body?.userId ?? '')
  if (!userId) {
    res.status(400).json({ ok: false, error: 'userId fehlt.' })
    return
  }

  const result = await sendPushToUsers([userId], {
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
}
