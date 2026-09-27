/**
 * Navegação com recarga completa. Usada depois de entrar/sair: o router do Next guarda em cache os
 * redirecionamentos do middleware (ex.: "/conta → login" de antes do login) e, numa navegação comum,
 * reaproveitaria esse redirecionamento velho. Recarregando, a página é pedida de novo com o cookie atual.
 */
export function hardNavigate(url: string) {
  window.location.replace(url)
}

/** Para onde mandar depois do login, respeitando `next` só se combinar com o papel do usuário. */
export function homeAfterLogin(user: { role: 'admin' | 'customer'; mustChangePassword: boolean }, next: string | null) {
  if (user.mustChangePassword) return '/conta/trocar-senha'
  const home = user.role === 'admin' ? '/admin' : '/conta'
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : null
  if (!safe) return home
  if (user.role === 'admin' && safe.startsWith('/conta')) return home
  if (user.role === 'customer' && safe.startsWith('/admin')) return home
  return safe
}
