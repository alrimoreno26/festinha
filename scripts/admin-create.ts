// Cria (ou promove) um usuário administrador com senha escolhida por você.
//
//   npm run admin:create -- --email voce@exemplo.com --name "Seu Nome"
//
// A senha é pedida no terminal e não aparece enquanto você digita.
// Usa o banco do .env.local; para produção, rode com a URL da branch "production".

import { eq } from 'drizzle-orm'
import { createInterface } from 'node:readline'
import { hashPassword, MIN_PASSWORD_LENGTH } from '../lib/server/auth/password'
import { db } from '../lib/server/db'
import * as t from '../lib/server/db/schema'
import { newId } from '../lib/server/ids'

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

/**
 * Pergunta sem ecoar o que é digitado. Uma única interface para todas as perguntas:
 * várias interfaces sobre o mesmo stdin disputam a entrada e a segunda pergunta nunca recebe resposta.
 */
function hiddenPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const out = rl as unknown as { _writeToOutput: (s: string) => void }
  const write = out._writeToOutput.bind(rl)
  let muted = false
  out._writeToOutput = (s: string) => {
    if (!muted) write(s)
  }
  // Fila de linhas: com entrada via pipe, várias linhas chegam antes de cada pergunta.
  const lines: string[] = []
  const waiting: ((line: string | null) => void)[] = []
  rl.on('line', (line) => (waiting.length ? waiting.shift()!(line) : lines.push(line)))
  rl.on('close', () => waiting.splice(0).forEach((w) => w(null)))

  return {
    async ask(question: string) {
      muted = false
      process.stdout.write(question)
      muted = true
      const line = lines.length ? lines.shift()! : await new Promise<string | null>((r) => waiting.push(r))
      muted = false
      process.stdout.write('\n')
      if (line === null) throw new Error('Entrada encerrada antes da resposta.')
      return line
    },
    close: () => rl.close(),
  }
}

async function main() {
  const email = arg('email')?.trim().toLowerCase()
  const name = arg('name')?.trim() || 'Administrador'
  if (!email || !email.includes('@')) throw new Error('Informe --email voce@exemplo.com')

  const prompt = hiddenPrompt()
  const password = await prompt.ask(`Senha para ${email}: `)
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  const confirm = await prompt.ask('Confirme a senha: ')
  prompt.close()
  if (confirm !== password) throw new Error('As senhas não coincidem.')

  const passwordHash = await hashPassword(password)
  const [existing] = await db.select().from(t.users).where(eq(t.users.email, email))
  if (existing) {
    await db
      .update(t.users)
      .set({ role: 'admin', passwordHash, mustChangePassword: false, name, updatedAt: new Date() })
      .where(eq(t.users.id, existing.id))
    await db.delete(t.sessions).where(eq(t.sessions.userId, existing.id))
    console.log(`✔ ${email} agora é administrador (senha atualizada).`)
  } else {
    await db.insert(t.users).values({ id: newId('usr'), email, name, role: 'admin', passwordHash })
    console.log(`✔ Administrador ${email} criado.`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✖', err.message)
    process.exit(1)
  })
