// Cadastra os pacotes do catálogo de clientes (preços e quantidades do PDF "PAPELARIA CATÁLOGO CLIENTES").
//
//   npm run catalog:load
//
// Só cria os que ainda não existem (pelo endereço/slug): rodar de novo não duplica nem sobrescreve
// o que você já editou no backoffice. O kit digital pronto entra oculto até você escolher os arquivos.
// Usa o banco do .env.local; para produção, rode com a URL da branch "production".

import type { PackageInput } from '../lib/contracts'
import { eq } from 'drizzle-orm'
import { db } from '../lib/server/db'
import * as t from '../lib/server/db/schema'
import * as packages from '../lib/server/domain/packages'
import { toUser } from '../lib/server/mappers'

const pkg = (p: Omit<PackageInput, 'coverUrl' | 'accessDays' | 'fileIds' | 'customizationLevel'> & Partial<PackageInput>): PackageInput => ({
  coverUrl: null,
  accessDays: null,
  fileIds: [],
  customizationLevel: 'full',
  ...p,
})

const CATALOG: PackageInput[] = [
  // ---- Impressos ----
  pkg({
    title: 'Lembrancinhas – 20 caixinhas',
    slug: 'lembrancinhas-20-caixinhas',
    kind: 'printed',
    priceCents: 4200,
    active: true,
    coverUrl: '/galeria/caixinhas-personalizadas.webp',
    description:
      'Caixinhas personalizadas com o tema, o nome e a idade da criança. Ideais para lembrancinhas cheias de carinho. Todos os temas e modelos personalizados.',
    items: [
      { name: 'Caixa Milk – 14 cm (altura) x 6,5 cm', quantity: 5 },
      { name: 'Caixa Meia Bala – 14 cm altura x 6 cm largura', quantity: 5 },
      { name: 'Caixa Cone – 14 cm altura x 6 cm largura (parte de baixo)', quantity: 5 },
      { name: 'Caixa Bem-casado – 5 cm altura + alça x 5,5 cm largura (parte de baixo)', quantity: 5 },
    ],
  }),
  pkg({
    title: 'Plaquinhas de mesa',
    slug: 'plaquinhas-de-mesa',
    kind: 'printed',
    priceCents: 3400,
    active: true,
    coverUrl: '/galeria/plaquinhas-de-mesa.webp',
    description:
      'Plaquinhas personalizadas com o tema da sua festa, nome, idade, cores e detalhes encantadores, perfeitas para colocar sobre as mesas e compor uma decoração cheia de charme e criatividade.',
    items: [{ name: 'Plaquinha de mesa personalizada', quantity: 10 }],
  }),
  pkg({
    title: 'Livrinhos de colorir',
    slug: 'livrinhos-de-colorir',
    kind: 'printed',
    priceCents: 3500,
    active: true,
    coverUrl: '/galeria/livrinhos-de-colorir.webp',
    description: 'Livrinhos com o tema da sua festa, perfeitos para estimular a imaginação e garantir momentos de diversão para as crianças.',
    items: [{ name: 'Livrinho de colorir personalizado', quantity: 10 }],
  }),
  pkg({
    title: 'Tags de papel personalizadas',
    slug: 'tags-de-papel-personalizadas',
    kind: 'printed',
    priceCents: 3300,
    active: true,
    coverUrl: '/galeria/tags-personalizadas.webp',
    description:
      'Dê um toque especial às suas lembrancinhas com tags personalizadas com o tema, nome e cores da sua festa! Perfeitas para decorar embalagens, sacolinhas e presentinhos.',
    items: [{ name: 'Tag de papel personalizada', quantity: 40 }],
  }),
  // ---- Digitais ----
  pkg({
    title: 'Personalizado digital',
    slug: 'personalizado-digital',
    kind: 'custom_digital',
    priceCents: 1900,
    active: true,
    coverUrl: '/galeria/personalizado-digital.webp',
    description:
      'Escolha o tema que mais combina com a sua comemoração e nós personalizamos cada detalhe com o nome, a idade, as cores e outras informações que você desejar. Você recebe o arquivo digital pronto para imprimir e montar. Livro de colorir personalizado incluso no kit.',
    items: [
      { name: 'Caixa Milk', quantity: 1 },
      { name: 'Caixa Cone', quantity: 1 },
      { name: 'Caixa Bem-casado', quantity: 1 },
      { name: 'Caixa Coração', quantity: 1 },
      { name: 'Livro de colorir personalizado', quantity: 1 },
    ],
  }),
  pkg({
    title: 'Tema individual digital',
    slug: 'tema-individual-digital',
    kind: 'custom_digital',
    customizationLevel: 'theme',
    priceCents: 1000,
    active: true,
    coverUrl: '/galeria/tema-individual.webp',
    description:
      'Diferentes modelos, caixinhas e itens no tema da sua escolha, em arquivo digital para imprimir e montar. Livro de colorir disponível em temas selecionados.',
    items: [{ name: 'Arquivos com caixinhas e itens no tema escolhido', quantity: 1 }],
  }),
  pkg({
    title: 'Coleção de arquivos digitais',
    slug: 'colecao-arquivos-digitais',
    kind: 'digital',
    customizationLevel: 'none',
    priceCents: 5500,
    // Fica oculto até você escolher os arquivos no backoffice.
    active: false,
    coverUrl: '/galeria/colecao-festinhas.webp',
    description:
      'Arquivos prontos para imprimir: catálogo de decorações por letras, kits prontos para festas, Arte & Doçura da Páscoa, Natal Criativo, toques criativos para canecas, Brilho de Mulher, Misturinhas (de tudo um pouco) e App que Salva. Livro de colorir personalizado incluso no kit.',
    items: [],
  }),
]

async function main() {
  const [admin] = await db.select().from(t.users).where(eq(t.users.role, 'admin')).limit(1)
  if (!admin) throw new Error('Nenhum administrador encontrado. Crie um com npm run admin:create.')
  const actor = toUser(admin)
  const existing = new Set((await db.select({ slug: t.packages.slug }).from(t.packages)).map((p) => p.slug))

  for (const input of CATALOG) {
    if (existing.has(input.slug)) {
      console.log(`= ${input.title} (já existe, mantido)`)
      continue
    }
    await packages.create(db, actor, input)
    console.log(`+ ${input.title}${input.active ? '' : ' (oculto: escolha os arquivos no backoffice)'}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha:', err.message ?? err)
    process.exit(1)
  })
