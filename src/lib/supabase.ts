import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase ist nicht konfiguriert. VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen in der .env stehen.',
  )
}

const configuredUrl = supabaseUrl.replace(/\/$/, '')

function shouldProxy() {
  return (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    !window.location.hostname.endsWith('supabase.co')
  )
}

function hostedFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (!shouldProxy()) return fetch(input, init)

  const href =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  if (!href.startsWith(configuredUrl)) return fetch(input, init)

  const suffix = href.slice(configuredUrl.length)
  if (suffix.startsWith('/storage/') || suffix.startsWith('/realtime/')) {
    return fetch(input, init)
  }

  const proxied = `${window.location.origin}/api/sb?u=${encodeURIComponent(suffix)}`
  if (typeof input === 'string' || input instanceof URL) {
    return fetch(proxied, init)
  }
  return fetch(new Request(proxied, input), init)
}

export const supabase = createClient<Database>(configuredUrl, supabaseAnonKey, {
  global: { fetch: hostedFetch },
})
