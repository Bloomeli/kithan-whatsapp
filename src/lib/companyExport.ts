export async function exportTicketToCompanyServer(
  ticketId: string,
): Promise<{
  ok: boolean
  folder?: string
  files?: number
  exported_at?: string
  error?: string
}> {
  const response = await fetch(
    `/api/archive-export?ticketId=${encodeURIComponent(ticketId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId }),
    },
  )

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean
    folder?: string
    files?: number
    exported_at?: string
    error?: string
  } | null

  if (!response.ok || !payload?.ok) {
    return {
      ok: false,
      error: payload?.error || 'Upload auf den Firmenserver ist fehlgeschlagen.',
    }
  }

  return {
    ok: true,
    folder: payload.folder,
    files: payload.files,
    exported_at: payload.exported_at,
  }
}
