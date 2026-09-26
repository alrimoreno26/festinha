import { hash, verify } from '@node-rs/argon2'

// argon2id com os parâmetros recomendados pela OWASP (19 MiB, 2 iterações).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

export const MIN_PASSWORD_LENGTH = 8

export function hashPassword(password: string) {
  return hash(password, OPTIONS)
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

const WORDS = ['festa', 'balao', 'bolo', 'confete', 'doce', 'laco']

/** Senha temporária fácil de digitar (ex.: "confete-4821"). O cliente troca no primeiro acesso. */
export function generateTempPassword() {
  const bytes = crypto.getRandomValues(new Uint32Array(2))
  return `${WORDS[bytes[0] % WORDS.length]}-${1000 + (bytes[1] % 9000)}`
}
