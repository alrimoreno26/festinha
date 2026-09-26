// Ponto único de acesso a dados para a UI: cada serviço chama a API (app/api) e
// devolve os erros como ServiceError.

export { accountService } from './account'
export { authService } from './auth'
export { checkoutService } from './checkout'
export { customersService } from './customers'
export { dashboardService } from './dashboard'
export { errorMessage, ServiceError } from './errors'
export { filesService } from './files'
export { ordersService } from './orders'
export { packagesService } from './packages'
export { devService } from './dev'
export { qk } from './keys'
