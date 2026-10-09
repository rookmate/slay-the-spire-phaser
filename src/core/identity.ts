let fallbackSequence = 0

/** Persistent identities also work in HTTP LAN previews without randomUUID. */
export function createIdentity(): string {
    const crypto = globalThis.crypto
    if (crypto?.randomUUID) return crypto.randomUUID()
    if (crypto?.getRandomValues) return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
    return `${Date.now().toString(36)}-${++fallbackSequence}`
}
