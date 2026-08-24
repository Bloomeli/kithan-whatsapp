export default async function handler(
  req: { method?: string; query?: { userId?: string } },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  res.status(200).json({
    ok: true,
    hasPrivateKey: Boolean((process.env.VAPID_PRIVATE_KEY || '').trim()),
    table: 'ok',
    saved: 0,
    userId: String(req.query?.userId ?? ''),
  })
}
