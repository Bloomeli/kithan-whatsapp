const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
  /\/$/,
  '',
)

const FORWARD_HEADERS = [
  'accept',
  'accept-profile',
  'apikey',
  'authorization',
  'content-profile',
  'content-type',
  'prefer',
  'range',
  'x-client-info',
]

function readQuery(
  req: { query?: Record<string, string | string[] | undefined>; url?: string },
) {
  const fromQuery = req.query?.u
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery
  if (req.url && req.url.includes('?')) {
    const search = new URL(req.url, 'https://n.local').searchParams.get('u')
    if (search) return search
  }
  return ''
}

export default async function handler(
  req: {
    method?: string
    url?: string
    headers?: Record<string, string | string[] | undefined>
    query?: Record<string, string | string[] | undefined>
    body?: unknown
  },
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

  const suffix = readQuery(req)
  if (!suffix.startsWith('/rest/') && !suffix.startsWith('/auth/')) {
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
    if (typeof req.body === 'string') init.body = req.body
    else if (req.body != null) init.body = JSON.stringify(req.body)
  }

  const target = new URL(suffix, `${SUPABASE_URL}/`)
  const response = await fetch(target, init)
  const buffer = Buffer.from(await response.arrayBuffer())
  res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
  const contentRange = response.headers.get('content-range')
  if (contentRange) res.setHeader('Content-Range', contentRange)
  res.status(response.status).end(buffer)
}
