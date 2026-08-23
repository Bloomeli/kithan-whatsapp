const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)

const FORWARD_HEADERS = [
  'accept',
  'apikey',
  'authorization',
  'cache-control',
  'content-type',
  'x-client-info',
  'x-upsert',
]

export const config = {
  api: { bodyParser: false },
  maxDuration: 30,
}

function readSuffix(req: { query?: Record<string, string | string[] | undefined>; url?: string }) {
  const fromQuery = req.query?.u
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery
  if (req.url && req.url.includes('?')) {
    const search = new URL(req.url, 'https://n.local').searchParams.get('u')
    if (search) return search
  }
  return ''
}

async function readRawBody(req: AsyncIterable<Buffer | string>) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export default async function handler(
  req: {
    method?: string
    url?: string
    headers?: Record<string, string | string[] | undefined>
    query?: Record<string, string | string[] | undefined>
  } & AsyncIterable<Buffer | string>,
  res: {
    status: (code: number) => { end: (body?: unknown) => void }
    setHeader: (name: string, value: string) => void
    end: (body?: unknown) => void
  },
) {
  if (!SUPABASE_URL) {
    res.status(500).end('Supabase ist auf Vercel nicht konfiguriert.')
    return
  }

  const suffix = readSuffix(req)
  if (!suffix.startsWith('/storage/')) {
    res.status(404).end('Not found')
    return
  }

  const headers = new Headers()
  for (const name of FORWARD_HEADERS) {
    const value = req.headers?.[name]
    if (typeof value === 'string' && value) headers.set(name, value)
  }

  const init: RequestInit = { method: req.method || 'GET', headers }
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    const body = await readRawBody(req)
    if (body.length > 4_200_000) {
      res.status(413).end('Datei ist zu groß für den Upload.')
      return
    }
    if (body.length > 0) init.body = body
  }

  const target = new URL(suffix, `${SUPABASE_URL}/`)
  const response = await fetch(target, init)
  const buffer = Buffer.from(await response.arrayBuffer())
  res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
  res.status(response.status).end(buffer)
}
