import { hashPassword } from '@/lib/server/auth/password'
import { seedDatabase, wipeToRealData } from '@/lib/server/seed'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createSeededDb, t } from '../helpers/db'

async function withRealAdmin() {
  const ctx = await createSeededDb()
  await ctx.db.insert(t.users).values({ id: 'usr_dono', email: 'dono@festinhas.com.br', name: 'Dono', role: 'admin', passwordHash: await hashPassword('senha-forte-123') })
  return ctx
}

describe('dados de exemplo e limpeza', () => {
  it('"Restaurar dados" nunca apaga o admin real', async () => {
    const { db } = await withRealAdmin()
    await seedDatabase(db, { kind: 'seed' })
    await seedDatabase(db, { kind: 'empty' })
    expect(await db.select().from(t.users).where(eq(t.users.id, 'usr_dono'))).toHaveLength(1)
  })

  it('com R2 (withFiles: false) os arquivos registrados são preservados', async () => {
    const { db } = await withRealAdmin()
    await db.insert(t.files).values({ id: 'fil_real', key: 'kits/real/arquivo.pdf', filename: 'arquivo.pdf', size: 10, mime: 'application/pdf' })
    await seedDatabase(db, { withFiles: false })
    expect(await db.select().from(t.files).where(eq(t.files.id, 'fil_real'))).toHaveLength(1)
  })

  it('limpeza total: sobra só o admin real e os arquivos', async () => {
    const { db } = await withRealAdmin()
    const result = await wipeToRealData(db)
    expect(result.realAdmins).toBe(1)
    expect((await db.select().from(t.users)).map((u) => u.email)).toEqual(['dono@festinhas.com.br'])
    expect(await db.select().from(t.orders)).toHaveLength(0)
    expect(await db.select().from(t.packages)).toHaveLength(0)
    expect(await db.select().from(t.entitlements)).toHaveLength(0)
    expect((await db.select().from(t.files)).length).toBeGreaterThan(0)
  })

  it('limpeza sem admin real é recusada (não deixa o sistema sem acesso)', async () => {
    const { db } = await createSeededDb()
    await expect(wipeToRealData(db)).rejects.toThrow('Nenhum administrador real')
    expect((await db.select().from(t.users)).length).toBeGreaterThan(0)
  })
})
