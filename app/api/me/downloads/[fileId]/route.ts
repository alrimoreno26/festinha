import * as account from '@/lib/server/domain/account'
import { db, route } from '@/lib/server/http'

/**
 * Autoriza e registra o download. Fase 3: devolve uma URL assinada do R2 (válida por ~5 min).
 * Até lá devolve um arquivo de demonstração embutido na própria URL.
 */
export const POST = route<{ fileId: string }>(async ({ actor, params }) => {
  const file = await account.authorizeDownload(db, actor, params.fileId)
  const demo = `Arquivo de demonstração — Festinhas\n\n${file.filename}\n${file.key}\n\nNa fase 3 este download vem do Cloudflare R2.`
  return {
    url: `data:text/plain;charset=utf-8;base64,${Buffer.from(demo).toString('base64')}`,
    filename: `${file.filename}.demo.txt`,
  }
})

// Depende da sessão/banco em cada chamada: nunca pré-renderizar nem cachear.
export const dynamic = 'force-dynamic'
