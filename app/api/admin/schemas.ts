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
  kind: z.enum(['digital', 'custom_digital', 'printed']).default('digital'),
  items: z.array(z.object({ name: z.string().max(200), quantity: z.number().int() })).max(50).default([]),
  customizationLevel: z.enum(['none', 'theme', 'full', 'business']).default('none'),
  line: z.enum(['festas', 'empresas']).default('festas'),
  variants: z
    .array(z.object({ id: z.string().max(40), label: z.string().max(80), priceCents: z.number().int(), quantity: z.number().int().optional() }))
    .max(20)
    .default([]),
  sheetPricing: z
    .object({ cardsPerSheet: z.number().int(), sheetPriceCents: z.number().int(), minUnitsForOptions: z.number().int() })
    .nullable()
    .default(null),
  shippingBox: z
    .object({ weightGrams: z.number(), heightCm: z.number(), widthCm: z.number(), lengthCm: z.number() })
    .nullable()
    .default(null),
})
