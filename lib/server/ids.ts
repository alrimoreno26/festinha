const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** ID legível com prefixo, ex.: newId('ord') → "ord_k3f9x2m1q8zt". */
export function newId(prefix: string, length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let id = ''
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length]
  return `${prefix}_${id}`
}

/** Token aleatório para cookies e links (256 bits, base64url). */
export function newToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Buffer.from(digest).toString('hex')
}
