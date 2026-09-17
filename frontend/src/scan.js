export function parseJsonResponse(rawText, fallbackMessage = 'Réponse invalide') {
  if (typeof rawText !== 'string') {
    throw new Error(fallbackMessage)
  }

  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new Error(fallbackMessage)
  }

  try {
    return JSON.parse(trimmed)
  } catch (error) {
    const preview = trimmed.slice(0, 180).replace(/\s+/g, ' ')
    throw new Error(`${fallbackMessage}: ${preview}`)
  }
}

export function normalizeScanData(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (payload && typeof payload === 'object') {
    if (payload.error) {
      const details = payload.details ? `: ${payload.details}` : ''
      throw new Error(`${payload.error}${details}`)
    }

    if (Array.isArray(payload.wifi)) return payload.wifi
    if (Array.isArray(payload.networks)) return payload.networks
  }

  if (payload === null || payload === undefined || payload === '') {
    return []
  }

  throw new Error('Le scan ne retourne pas un tableau JSON valide.')
}
