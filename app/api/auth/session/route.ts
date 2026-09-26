import { route } from '@/lib/server/http'

export const GET = route(async ({ actor }) => (actor ? { user: actor } : null))
