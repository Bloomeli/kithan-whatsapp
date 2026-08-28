/** Medien bleiben gespeichert, bis jemand sie ausdrücklich löscht. */
export const MEDIA_TTL_HOURS = 0

export function isChatMediaExpired(_createdAt: string): boolean {
  return false
}

export async function purgeExpiredChatMedia(): Promise<void> {
  // Automatisches Löschen ist deaktiviert.
}
