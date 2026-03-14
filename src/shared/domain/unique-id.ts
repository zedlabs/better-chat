export const createUniqueId = (): string => {
  const hasCryptoSupport = typeof crypto !== 'undefined'

  if (hasCryptoSupport && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const randomChunk = Math.random().toString(16).slice(2)
  return `${Date.now()}-${randomChunk}`
}
