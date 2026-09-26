import { defineConfig } from 'drizzle-kit'

// drizzle-kit roda fora do Next, então carrega o .env.local manualmente.
try {
  process.loadEnvFile('.env.local')
} catch {}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/server/db/schema.ts',
  out: './drizzle',
  // Migrações usam a conexão direta (sem pooler).
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
  strict: true,
})
