import * as packages from '@/lib/server/domain/packages'
import { db, route } from '@/lib/server/http'

export const GET = route(() => packages.listPublic(db))
