export default async function handler(
  req: { method?: string },
  res: {
    status: (code: number) => { json: (body: unknown) => void }
  },
) {
  res.status(200).json({
    ok: false,
    error: 'Test läuft über /api/notify.',
  })
}
