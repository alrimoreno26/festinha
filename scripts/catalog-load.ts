// Cadastra os pacotes do catálogo de clientes (preços e quantidades do PDF "PAPELARIA CATÁLOGO CLIENTES").
//
//   npm run catalog:load
//
// Só cria os que ainda não existem (pelo endereço/slug): rodar de novo não duplica nem sobrescreve
// o que você já editou no backoffice. O kit digital pronto entra oculto até você escolher os arquivos.
// Impressos já cadastrados sem medidas de embalagem recebem as medidas estimadas (as já preenchidas não mudam).
// Usa o banco do .env.local; para produção, rode com a URL da branch "production".

import type { PackageInput } from '../lib/contracts'
import { eq } from 'drizzle-orm'
import { db } from '../lib/server/db'
import * as t from '../lib/server/db/schema'
import * as packages from '../lib/server/domain/packages'
import { toUser } from '../lib/server/mappers'

const pkg = (
  p: Omit<PackageInput, 'coverUrl' | 'accessDays' | 'fileIds' | 'customizationLevel' | 'shippingBox' | 'line' | 'variants'> & Partial<PackageInput>,
): PackageInput => ({
  coverUrl: null,
  accessDays: null,
  fileIds: [],
  customizationLevel: 'full',
  shippingBox: null,
  line: 'festas',
  variants: [],
  ...p,
})

// Medidas ESTIMADAS da embalagem de cada impresso (peso em gramas, medidas em cm).
// Pese e meça a caixa de verdade e corrija no backoffice: o frete cobrado depende disso.
const BOX = {
  lembrancinhas: { weightGrams: 600, heightCm: 15, widthCm: 20, lengthCm: 30 },
  plaquinhas: { weightGrams: 300, heightCm: 5, widthCm: 20, lengthCm: 25 },
  livrinhos: { weightGrams: 500, heightCm: 5, widthCm: 18, lengthCm: 25 },
  tags: { weightGrams: 200, heightCm: 4, widthCm: 15, lengthCm: 20 },
  cartoes: { weightGrams: 250, heightCm: 4, widthCm: 11, lengthCm: 16 },
}

// Opções de quantidade dos cartões para empresas. PREÇOS DE EXEMPLO (R$ 1,00): defina os reais no backoffice
// antes de mostrar no catálogo (os cartões entram ocultos).
const CARD_OPTIONS = [
  { id: 'opt_50', label: '50 unidades', priceCents: 100 },
  { id: 'opt_100', label: '100 unidades', priceCents: 100 },
  { id: 'opt_200', label: '200 unidades', priceCents: 100 },
]

const CATALOG: PackageInput[] = [
  // ---- Impressos ----
  pkg({
    title: 'Lembrancinhas – 20 caixinhas',
    slug: 'lembrancinhas-20-caixinhas',
    kind: 'printed',
    shippingBox: BOX.lembrancinhas,
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
    shippingBox: BOX.plaquinhas,
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
    shippingBox: BOX.livrinhos,
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
    shippingBox: BOX.tags,
    priceCents: 3300,
    active: true,
    coverUrl: '/galeria/tags-personalizadas.webp',
    description:
      'Dê um toque especial às suas lembrancinhas com tags personalizadas com o tema, nome e cores da sua festa! Perfeitas para decorar embalagens, sacolinhas e presentinhos.',
    items: [{ name: 'Tag de papel personalizada', quantity: 40 }],
  }),
  // ---- Para empresas (ocultos até definir os preços) ----
  pkg({
    title: 'Cartão de garantia',
    slug: 'cartao-de-garantia',
    kind: 'printed',
    line: 'empresas',
    customizationLevel: 'business',
    priceCents: 100,
    variants: CARD_OPTIONS,
    active: false,
    coverUrl: '/galeria/cartao-garantia.webp',
    shippingBox: BOX.cartoes,
    description:
      'Cartão de garantia com a identidade da sua marca: logo e frase na frente; no verso, campos para produto, material, data da compra e prazo, com a informação da garantia legal (CDC). Impresso frente e verso, pronto para acompanhar cada venda.',
    items: [{ name: 'Cartão de garantia frente e verso (aprox. 5 x 8 cm)', quantity: 1 }],
  }),
  pkg({
    title: 'Cartão de cuidados com joias',
    slug: 'cartao-de-cuidados-com-joias',
    kind: 'printed',
    line: 'empresas',
    customizationLevel: 'business',
    priceCents: 100,
    variants: CARD_OPTIONS,
    active: false,
    coverUrl: '/galeria/cartao-cuidados-joias.webp',
    shippingBox: BOX.cartoes,
    description:
      'Cartão com dicas para o seu cliente conservar as peças por mais tempo (água, produtos químicos, manuseio, limpeza e armazenamento), com o logo e as cores da sua marca. Impresso em papel fotográfico.',
    items: [{ name: 'Cartão de cuidados (aprox. 5 x 7,5 cm)', quantity: 1 }],
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
  const existing = new Map((await db.select({ id: t.packages.id, slug: t.packages.slug, shippingBox: t.packages.shippingBox }).from(t.packages)).map((p) => [p.slug, p]))

  for (const input of CATALOG) {
    const found = existing.get(input.slug)
    if (found) {
      if (!found.shippingBox && input.shippingBox) {
        await db.update(t.packages).set({ shippingBox: input.shippingBox, updatedAt: new Date() }).where(eq(t.packages.id, found.id))
        console.log(`~ ${input.title} (já existe; medidas estimadas da embalagem adicionadas)`)
      } else console.log(`= ${input.title} (já existe, mantido)`)
      continue
    }
    await packages.create(db, actor, input)
    const hint = input.kind === 'digital' ? 'escolha os arquivos' : 'defina os preços'
    console.log(`+ ${input.title}${input.active ? '' : ` (oculto: ${hint} no backoffice)`}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha:', err.message ?? err)
    process.exit(1)
  })
