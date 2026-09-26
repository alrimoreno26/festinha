// Ponto único de acesso a dados para a UI.
// Na fase 1 os serviços usam o mock (lib/mock); nas próximas fases passam a chamar a API
// mantendo as mesmas assinaturas.

export { accountService } from './account'
export { authService } from './auth'
export { checkoutService } from './checkout'
export { customersService } from './customers'
export { dashboardService } from './dashboard'
export { errorMessage, ServiceError } from './errors'
export { filesService } from './files'
export { ordersService } from './orders'
export { packagesService } from './packages'
export { qk } from './keys'
