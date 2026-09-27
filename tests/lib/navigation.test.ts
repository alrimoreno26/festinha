import { homeAfterLogin } from '@/lib/navigation'
import { describe, expect, it } from 'vitest'

const admin = { role: 'admin' as const, mustChangePassword: false }
const customer = { role: 'customer' as const, mustChangePassword: false }

describe('destino depois do login', () => {
  it('respeita o next quando combina com o papel', () => {
    expect(homeAfterLogin(admin, '/admin/pedidos')).toBe('/admin/pedidos')
    expect(homeAfterLogin(customer, '/conta/pedidos')).toBe('/conta/pedidos')
    expect(homeAfterLogin(customer, '/pacotes/kit-safari')).toBe('/pacotes/kit-safari')
  })

  it('admin vindo de /conta vai para /admin (e cliente vindo de /admin vai para /conta)', () => {
    expect(homeAfterLogin(admin, '/conta')).toBe('/admin')
    expect(homeAfterLogin(customer, '/admin')).toBe('/conta')
  })

  it('ignora next externo e manda trocar a senha temporária primeiro', () => {
    expect(homeAfterLogin(admin, '//site-malicioso.com')).toBe('/admin')
    expect(homeAfterLogin(customer, 'https://site-malicioso.com')).toBe('/conta')
    expect(homeAfterLogin({ ...customer, mustChangePassword: true }, '/conta/pedidos')).toBe('/conta/trocar-senha')
  })
})
