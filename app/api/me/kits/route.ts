import * as account from '@/lib/server/domain/account'
import { db, route } from '@/lib/server/http'

export const GET = route(({ actor }) => account.myKits(db, actor))
