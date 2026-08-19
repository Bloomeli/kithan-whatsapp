import { supabase } from './supabase'
import { CHAT_MEDIA_BUCKET } from '../types'

/** Vorläufige Speicherspar-Regel: Medien nach 36 Stunden löschen. */
export const MEDIA_TTL_HOURS = 36
export const MEDIA_TTL_MS = MEDIA_TTL_HOURS * 60 * 60 * 1000

export function isChatMediaExpired(createdAt: string): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created >= MEDIA_TTL_MS
}

export async function purgeExpiredChatMedia(): Promise<void> {
  const { error } = await supabase.rpc('purge_expired_chat_media')
  if (!error) return

  await purgeExpiredChatMediaFallback()
}

async function purgeExpiredChatMediaFallback(): Promise<void> {
  const cutoff = new Date(Date.now() - MEDIA_TTL_MS).toISOString()
  const { data, error } = await supabase
    .from('messages')
    .select('id, media_url')
    .not('media_url', 'is', null)
    .lt('created_at', cutoff)
    .limit(100)

  if (error || !data?.length) return

  const paths = data
    .map((row) => storagePathFromPublicUrl(row.media_url))
    .filter((path): path is string => Boolean(path))

  if (paths.length > 0) {
    await supabase.storage.from(CHAT_MEDIA_BUCKET).remove(paths)
  }

  await supabase
    .from('messages')
    .update({ media_url: null })
    .in(
      'id',
      data.map((row) => row.id),
    )
}

function storagePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/object/public/${CHAT_MEDIA_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length))
}
