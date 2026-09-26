// Dados iniciais do mock. Datas são relativas ao momento do seed para os cenários
// (acesso vencendo, vencido, etc.) sempre fazerem sentido.

import type { Entitlement, FileItem, Order, Package } from '@/lib/types'
import type { MockDB, MockUser } from './store'

/** Contas de teste do mock (usadas também nos atalhos de login da DevToolbar). */
export const SEED_ACCOUNTS = {
  admin: { email: 'admin@festinhas.test', password: 'admin123' },
  maria: { email: 'maria@festinhas.test', password: 'cliente123' },
  ana: { email: 'ana@festinhas.test', password: 'temp-4821' },
} as const

const DAY = 24 * 60 * 60 * 1000

export function createSeed(): MockDB {
  const now = Date.now()
  const ago = (days: number) => new Date(now - days * DAY).toISOString()
  const ahead = (days: number) => new Date(now + days * DAY).toISOString()

  const users: MockUser[] = [
    { id: 'usr_admin', email: SEED_ACCOUNTS.admin.email, password: SEED_ACCOUNTS.admin.password, name: 'Festinhas Admin', phone: null, role: 'admin', mustChangePassword: false, createdAt: ago(120) },
    { id: 'usr_maria', email: SEED_ACCOUNTS.maria.email, password: SEED_ACCOUNTS.maria.password, name: 'Maria Souza', phone: '(48) 99999-1111', role: 'customer', mustChangePassword: false, createdAt: ago(60) },
    { id: 'usr_ana', email: SEED_ACCOUNTS.ana.email, password: SEED_ACCOUNTS.ana.password, name: 'Ana Lima', phone: '(48) 99999-2222', role: 'customer', mustChangePassword: true, createdAt: ago(1) },
    { id: 'usr_joao', email: 'joao@festinhas.test', password: 'cliente123', name: 'João Pereira', phone: '(11) 98888-3333', role: 'customer', mustChangePassword: false, createdAt: ago(40) },
    { id: 'usr_carla', email: 'carla@festinhas.test', password: 'cliente123', name: 'Carla Mendes', phone: '(21) 97777-4444', role: 'customer', mustChangePassword: false, createdAt: ago(15) },
  ]

  const f = (id: string, key: string, size: number, mime: string, days: number): FileItem => ({
    id,
    key,
    filename: key.split('/').pop()!,
    size,
    mime,
    createdAt: ago(days),
  })
  const PDF = 'application/pdf'
  const PNG = 'image/png'
  const ZIP = 'application/zip'

  const files: FileItem[] = [
    f('fil_saf1', 'kits/safari/topo-de-bolo.pdf', 2_400_000, PDF, 90),
    f('fil_saf2', 'kits/safari/toppers-docinhos.pdf', 1_800_000, PDF, 90),
    f('fil_saf3', 'kits/safari/bandeirinhas.pdf', 3_100_000, PDF, 90),
    f('fil_saf4', 'kits/safari/caixinha-milk.pdf', 950_000, PDF, 90),
    f('fil_saf5', 'kits/safari/convite-editavel.png', 4_200_000, PNG, 90),
    f('fil_mar1', 'kits/fundo-do-mar/topo-de-bolo.pdf', 2_100_000, PDF, 70),
    f('fil_mar2', 'kits/fundo-do-mar/toppers-docinhos.pdf', 1_600_000, PDF, 70),
    f('fil_mar3', 'kits/fundo-do-mar/rotulos.pdf', 1_200_000, PDF, 70),
    f('fil_mar4', 'kits/fundo-do-mar/kit-completo.zip', 38_000_000, ZIP, 70),
    f('fil_pri1', 'kits/princesas/topo-de-bolo.pdf', 2_600_000, PDF, 50),
    f('fil_pri2', 'kits/princesas/tags-lembrancinha.pdf', 800_000, PDF, 50),
    f('fil_pri3', 'kits/princesas/painel-60x90.pdf', 12_500_000, PDF, 50),
    f('fil_fut1', 'kits/futebol/topo-de-bolo.pdf', 2_000_000, PDF, 30),
    f('fil_fut2', 'kits/futebol/bandeirinhas.pdf', 2_900_000, PDF, 30),
    f('fil_fut3', 'kits/futebol/caixa-bombom.pdf', 1_100_000, PDF, 30),
    f('fil_uni1', 'kits/unicornio/topo-de-bolo.pdf', 2_300_000, PDF, 10),
    f('fil_gen1', 'extras/instrucoes-de-montagem.pdf', 450_000, PDF, 100),
    f('fil_gen2', 'extras/moldes-basicos.pdf', 1_300_000, PDF, 100),
  ]

  const p = (data: Omit<Package, 'createdAt' | 'updatedAt'>, days: number): Package => ({
    ...data,
    createdAt: ago(days),
    updatedAt: ago(Math.max(0, days - 5)),
  })

  const packages: Package[] = [
    p({ id: 'pkg_safari', slug: 'kit-safari', title: 'Kit Safári', description: 'Topo de bolo, toppers, bandeirinhas, caixinha milk e convite editável com a turma do safári. Pronto para imprimir, recortar e montar.', coverUrl: '/galeria/pacote-completo.png', priceCents: 4990, active: true, accessDays: null, fileIds: ['fil_saf1', 'fil_saf2', 'fil_saf3', 'fil_saf4', 'fil_saf5', 'fil_gen1'] }, 90),
    p({ id: 'pkg_mar', slug: 'kit-fundo-do-mar', title: 'Kit Fundo do Mar', description: 'Tudo para uma festa no fundo do mar: topo de bolo, toppers, rótulos e o kit completo em ZIP.', coverUrl: '/galeria/pacote-individuais-01.png', priceCents: 5990, active: true, accessDays: 30, fileIds: ['fil_mar1', 'fil_mar2', 'fil_mar3', 'fil_mar4', 'fil_gen1'] }, 70),
    p({ id: 'pkg_princesas', slug: 'kit-princesas', title: 'Kit Princesas', description: 'Topo de bolo, tags de lembrancinha e painel 60x90 para uma festa encantada.', coverUrl: '/galeria/pacote-individuais-02.jpg', priceCents: 6990, active: true, accessDays: 30, fileIds: ['fil_pri1', 'fil_pri2', 'fil_pri3', 'fil_gen1', 'fil_gen2'] }, 50),
    p({ id: 'pkg_futebol', slug: 'kit-futebol', title: 'Kit Futebol', description: 'Kit para os pequenos craques: topo de bolo, bandeirinhas e caixa bombom.', coverUrl: '/galeria/cartaz-papelaria-1.png', priceCents: 3990, active: true, accessDays: null, fileIds: ['fil_fut1', 'fil_fut2', 'fil_fut3'] }, 30),
    p({ id: 'pkg_unicornio', slug: 'kit-unicornio', title: 'Kit Unicórnio', description: 'Em breve! Kit unicórnio com tons pastel.', coverUrl: '/galeria/cartaz-papelaria-2.png', priceCents: 5490, active: false, accessDays: null, fileIds: ['fil_uni1'] }, 10),
  ]

  const o = (
    id: string,
    userId: string | null,
    name: string,
    email: string,
    packageId: string,
    amountCents: number,
    status: Order['status'],
    method: Order['method'],
    days: number,
  ): Order => ({
    id,
    userId,
    name,
    email,
    phone: '(48) 99999-0000',
    packageId,
    amountCents,
    status,
    method,
    createdAt: ago(days),
    paidAt: status === 'pending' || status === 'rejected' ? null : ago(days),
  })

  const orders: Order[] = [
    o('ord_1001', 'usr_maria', 'Maria Souza', 'maria@festinhas.test', 'pkg_safari', 4990, 'approved', 'pix', 58),
    o('ord_1002', 'usr_maria', 'Maria Souza', 'maria@festinhas.test', 'pkg_mar', 5990, 'approved', 'card', 25),
    o('ord_1003', 'usr_maria', 'Maria Souza', 'maria@festinhas.test', 'pkg_princesas', 6990, 'approved', 'pix', 45),
    o('ord_1004', 'usr_joao', 'João Pereira', 'joao@festinhas.test', 'pkg_futebol', 3990, 'charged_back', 'card', 38),
    o('ord_1005', null, 'Pedro Alves', 'pedro@festinhas.test', 'pkg_safari', 4990, 'rejected', 'card', 20),
    o('ord_1006', 'usr_carla', 'Carla Mendes', 'carla@festinhas.test', 'pkg_futebol', 3990, 'approved', 'pix', 14),
    o('ord_1007', 'usr_carla', 'Carla Mendes', 'carla@festinhas.test', 'pkg_safari', 4990, 'refunded', 'card', 12),
    o('ord_1008', null, 'Lucia Rocha', 'lucia@festinhas.test', 'pkg_princesas', 6990, 'pending', 'pix', 0),
    o('ord_1009', 'usr_ana', 'Ana Lima', 'ana@festinhas.test', 'pkg_safari', 4990, 'approved', 'pix', 1),
    o('ord_1010', 'usr_carla', 'Carla Mendes', 'carla@festinhas.test', 'pkg_mar', 5990, 'approved', 'card', 3),
  ]

  const e = (id: string, userId: string, packageId: string, orderId: string | null, days: number, extra: Partial<Entitlement> = {}): Entitlement => ({
    id,
    userId,
    packageId,
    orderId,
    grantedBy: orderId ? 'purchase' : 'manual',
    createdAt: ago(days),
    expiresAt: null,
    revokedAt: null,
    ...extra,
  })

  const entitlements: Entitlement[] = [
    // Maria: um de cada estado (ativo, vencendo, vencido).
    e('ent_1', 'usr_maria', 'pkg_safari', 'ord_1001', 58),
    e('ent_2', 'usr_maria', 'pkg_mar', 'ord_1002', 25, { expiresAt: ahead(5) }),
    e('ent_3', 'usr_maria', 'pkg_princesas', 'ord_1003', 45, { expiresAt: ago(15) }),
    // João: revogado por chargeback.
    e('ent_4', 'usr_joao', 'pkg_futebol', 'ord_1004', 38, { revokedAt: ago(30) }),
    e('ent_5', 'usr_carla', 'pkg_futebol', 'ord_1006', 14),
    e('ent_6', 'usr_carla', 'pkg_safari', 'ord_1007', 12, { revokedAt: ago(10) }),
    e('ent_7', 'usr_ana', 'pkg_safari', 'ord_1009', 1),
    e('ent_8', 'usr_carla', 'pkg_mar', 'ord_1010', 3, { expiresAt: ahead(27) }),
    // Brinde concedido manualmente.
    e('ent_9', 'usr_carla', 'pkg_unicornio', null, 2),
  ]

  return {
    users,
    files,
    folders: ['kits', 'kits/safari', 'kits/fundo-do-mar', 'kits/princesas', 'kits/futebol', 'kits/unicornio', 'extras'],
    packages,
    orders,
    entitlements,
    downloads: [
      { id: 'dl_1', userId: 'usr_maria', fileId: 'fil_saf1', createdAt: ago(57) },
      { id: 'dl_2', userId: 'usr_maria', fileId: 'fil_saf2', createdAt: ago(57) },
      { id: 'dl_3', userId: 'usr_carla', fileId: 'fil_fut1', createdAt: ago(13) },
    ],
    outbox: [],
    passwordResets: [],
  }
}
