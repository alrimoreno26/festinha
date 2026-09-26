import { z } from 'zod'

export const packageInputSchema = z.object({
  title: z.string().max(200),
  slug: z.string().max(200),
  description: z.string().max(5000),
  // Até a fase 3 a capa pode vir como data URL (imagem reduzida no navegador).
  coverUrl: z.string().max(1_500_000).nullable(),
  priceCents: z.number().int(),
  active: z.boolean(),
  accessDays: z.number().int().nullable(),
  fileIds: z.array(z.string()).max(500),
})
