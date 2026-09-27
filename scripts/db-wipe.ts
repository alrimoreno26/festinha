// Deixa o banco só com dados reais: apaga clientes, pedidos, acessos, pacotes e as contas de exemplo.
// Mantém os administradores reais e os arquivos/pastas (que refletem o bucket R2).
// Recusa se não houver um admin real (crie antes com `npm run admin:create`).
//
//   npm run db:wipe -- --yes

import { db } from '../lib/server/db'
import { wipeToRealData } from '../lib/server/seed'

async function main() {
  if (!process.argv.includes('--yes')) throw new Error('Isto apaga dados. Rode com --yes para confirmar.')
  const r = await wipeToRealData(db)
  console.log(`✔ Limpo. Admins reais mantidos: ${r.realAdmins}. Usuários removidos: ${r.removedUsers}.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✖', err.message)
    process.exit(1)
  })
