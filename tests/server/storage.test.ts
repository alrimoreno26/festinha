import * as account from '@/lib/server/domain/account'
import * as customers from '@/lib/server/domain/customers'
import * as files from '@/lib/server/domain/files'
import type { Storage, StoredObject } from '@/lib/server/storage'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createSeededDb, t } from '../helpers/db'

/** Bucket falso em memória com o mesmo contrato do R2. */
function fakeBucket(initial: StoredObject[] = []) {
  const objects = new Map(initial.map((o) => [o.key, o]))
  const deleted: string[] = []
  const storage: Storage = {
    kind: 'r2',
    bucket: 'festinha-teste',
    presignUpload: async (key, contentType, size) => ({ url: `https://r2.test/${key}?put&size=${size}`, headers: { 'content-type': contentType } }),
    head: async (key) => objects.get(key) ?? null,
    presignDownload: async (key, filename) => `https://r2.test/${key}?get&name=${encodeURIComponent(filename)}`,
    delete: async (key) => {
      deleted.push(key)
      objects.delete(key)
    },
    putFolder: async (path) => {
      objects.set(`${path}/`, { key: `${path}/`, size: 0 })
    },
    async *list() {
      yield* objects.values()
    },
  }
  /** Simula o navegador concluindo o PUT. */
  const put = (key: string, size: number) => objects.set(key, { key, size })
  return { storage, objects, deleted, put }
}

const upload = { folder: 'kits/safari', filename: 'Painel Safári 60x90.pdf', size: 3_000_000, mime: 'application/pdf' }

describe('upload direto para o R2', () => {
  it('assina a URL com a key normalizada e só registra depois que o objeto existe', async () => {
    const { db, admin } = await createSeededDb()
    const bucket = fakeBucket()

    const ticket = await files.prepareUpload(db, admin, upload, bucket.storage)
    expect(ticket.key).toBe('kits/safari/painel-safari-60x90.pdf')
    expect(ticket.uploadUrl).toContain('size=3000000')

    // O navegador ainda não enviou: não pode registrar.
    await expect(files.registerUpload(db, admin, upload, bucket.storage)).rejects.toMatchObject({ code: 'VALIDATION' })

    bucket.put(ticket.key, 2_999_000)
    const file = await files.registerUpload(db, admin, upload, bucket.storage)
    // O tamanho gravado é o real do bucket, não o declarado pelo navegador.
    expect(file).toMatchObject({ key: ticket.key, size: 2_999_000 })
  })

  it('não assina upload para pasta com ".." nem acima do limite', async () => {
    const { db, admin } = await createSeededDb()
    const { storage } = fakeBucket()
    const ticket = await files.prepareUpload(db, admin, { ...upload, folder: '../../segredos' }, storage)
    expect(ticket.key).toBe('segredos/painel-safari-60x90.pdf')
    await expect(files.prepareUpload(db, admin, { ...upload, size: 600 * 1024 * 1024 }, storage)).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('cliente não consegue pedir URL de upload', async () => {
    const { db, maria } = await createSeededDb()
    await expect(files.prepareUpload(db, maria, upload, fakeBucket().storage)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('exclusão', () => {
  it('apaga o objeto do bucket junto com o registro', async () => {
    const { db, admin } = await createSeededDb()
    const bucket = fakeBucket([{ key: 'kits/safari/caixinha-milk.pdf', size: 950_000 }])
    await files.remove(db, admin, 'fil_saf4', { force: true }, bucket.storage)
    expect(bucket.deleted).toEqual(['kits/safari/caixinha-milk.pdf'])
    expect(await db.select().from(t.files).where(eq(t.files.id, 'fil_saf4'))).toHaveLength(0)
  })

  it('se o bucket falhar, o registro continua (dá para tentar de novo)', async () => {
    const { db, admin } = await createSeededDb()
    const bucket = fakeBucket()
    bucket.storage.delete = async () => {
      throw new Error('R2 fora do ar')
    }
    await expect(files.remove(db, admin, 'fil_saf4', { force: true }, bucket.storage)).rejects.toThrow('R2 fora do ar')
    expect(await db.select().from(t.files).where(eq(t.files.id, 'fil_saf4'))).toHaveLength(1)
  })
})

describe('renomear', () => {
  it('muda o nome exibido sem mexer na key do bucket', async () => {
    const { db, admin } = await createSeededDb()
    const file = await files.rename(db, admin, 'fil_saf1', 'Topo de Bolo — Safári.pdf')
    expect(file).toMatchObject({ key: 'kits/safari/topo-de-bolo.pdf', filename: 'Topo de Bolo — Safári.pdf' })
    await expect(files.rename(db, admin, 'fil_saf2', 'Topo de Bolo — Safári.pdf')).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('sincronizar com o bucket', () => {
  const bucketObjects = () => [
    { key: 'kits/safari/topo-de-bolo.pdf', size: 2_400_000 }, // já registrado
    { key: 'kits/dinossauro/', size: 0 }, // "pasta" criada no painel
    { key: 'kits/dinossauro/Topo de Bolo Dino.PDF', size: 1_000_000 },
    { key: 'kits/dinossauro/moldes.zip', size: 5_000_000 },
    { key: 'kits/vazia/', size: 0 }, // pasta vazia criada no painel
  ]

  it('importa arquivos e pastas novos e só informa (sem apagar) os registros sem objeto', async () => {
    const { db, admin } = await createSeededDb()
    const bucket = fakeBucket(bucketObjects())
    const result = await files.syncFromBucket(db, admin, {}, bucket.storage)
    expect(result).toMatchObject({ added: 2, alreadyRegistered: 1, missingInBucket: 17, removed: 0, deactivatedPackages: [] })
    expect(result.affectedPackages).toBeGreaterThan(0)
    expect(result.addedFolders).toBe(2) // kits/dinossauro e kits/vazia

    const [dino] = await db.select().from(t.files).where(eq(t.files.key, 'kits/dinossauro/Topo de Bolo Dino.PDF'))
    expect(dino).toMatchObject({ filename: 'Topo de Bolo Dino.PDF', mime: 'application/pdf', size: 1_000_000 })
    expect((await files.listFolder(db, admin, 'kits', bucket.storage)).folders.map((f) => f.name)).toContain('vazia')

    // Rodar de novo não duplica.
    expect(await files.syncFromBucket(db, admin, {}, bucket.storage)).toMatchObject({ added: 0, addedFolders: 0 })
  })

  it('com prune o banco fica igual ao bucket e pacotes sem arquivos saem do catálogo', async () => {
    const { db, admin } = await createSeededDb()
    const bucket = fakeBucket(bucketObjects())
    const result = await files.syncFromBucket(db, admin, { prune: true }, bucket.storage)
    expect(result).toMatchObject({ added: 2, removed: 17, missingInBucket: 0 })
    // Safári ainda tem o topo-de-bolo; os outros ficaram vazios e foram ocultados.
    expect(result.deactivatedPackages.sort()).toEqual(['Kit Fundo do Mar', 'Kit Futebol', 'Kit Princesas'])

    const keys = (await db.select({ key: t.files.key }).from(t.files)).map((f) => f.key).sort()
    expect(keys).toEqual(['kits/dinossauro/Topo de Bolo Dino.PDF', 'kits/dinossauro/moldes.zip', 'kits/safari/topo-de-bolo.pdf'])
    const root = await files.listFolder(db, admin, '', bucket.storage)
    expect(root.folders.map((f) => f.name)).toEqual(['kits']) // "extras" não existe no bucket
    const [safari] = await db.select().from(t.packages).where(eq(t.packages.id, 'pkg_safari'))
    expect(safari.active).toBe(true)
  })

  it('criar e excluir pasta no painel também cria/apaga no bucket', async () => {
    const { db, admin } = await createSeededDb()
    const bucket = fakeBucket()
    const path = await files.createFolder(db, admin, 'kits', 'Kit Unicórnio 2', bucket.storage)
    expect(bucket.objects.has(`${path}/`)).toBe(true)
    await files.removeFolder(db, admin, path, bucket.storage)
    expect(bucket.deleted).toContain(`${path}/`)
  })

  it('no modo demonstração avisa que o R2 não está configurado', async () => {
    const { db, admin } = await createSeededDb()
    const { demoStorage } = await import('@/lib/server/storage')
    await expect(files.syncFromBucket(db, admin, {}, demoStorage)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('download', () => {
  it('devolve URL assinada com o nome do arquivo e registra', async () => {
    const { db, admin, maria } = await createSeededDb()
    const bucket = fakeBucket([{ key: 'kits/safari/topo-de-bolo.pdf', size: 2_400_000 }])
    const before = (await customers.get(db, admin, maria.id)).downloadsCount
    const link = await account.downloadLink(db, maria, 'fil_saf1', bucket.storage)
    expect(link).toEqual({ url: 'https://r2.test/kits/safari/topo-de-bolo.pdf?get&name=topo-de-bolo.pdf', filename: 'topo-de-bolo.pdf' })
    expect((await customers.get(db, admin, maria.id)).downloadsCount).toBe(before + 1)
  })

  it('objeto ausente no bucket dá erro amigável e não conta como download', async () => {
    const { db, admin, maria } = await createSeededDb()
    const before = (await customers.get(db, admin, maria.id)).downloadsCount
    await expect(account.downloadLink(db, maria, 'fil_saf1', fakeBucket().storage)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await customers.get(db, admin, maria.id)).downloadsCount).toBe(before)
  })

  it('sem acesso não chega nem a consultar o bucket', async () => {
    const { db, maria } = await createSeededDb()
    const bucket = fakeBucket()
    let asked = false
    bucket.storage.head = async () => {
      asked = true
      return null
    }
    await expect(account.downloadLink(db, maria, 'fil_pri3', bucket.storage)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(asked).toBe(false)
  })
})
