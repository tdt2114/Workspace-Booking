export async function readApiError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { message?: unknown; error?: unknown; details?: unknown }
    const message = Array.isArray(data.message)
      ? data.message.filter((item): item is string => typeof item === "string").join(" ")
      : typeof data.message === "string"
        ? data.message
        : undefined
    const error = typeof data.error === "string" ? data.error : undefined
    const details = typeof data.details === "string" ? data.details : undefined

    return message || error || details || fallback
  } catch {
    return fallback
  }
}
