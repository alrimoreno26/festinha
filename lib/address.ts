import type { ShippingAddress } from './types'

export const formatCep = (cep: string) => cep.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')

/** Endereço em duas linhas: "Rua X, 10 – apto 2" / "Bairro – Cidade/UF – CEP". */
export function addressLines(a: ShippingAddress) {
  const first = [`${a.street}${a.number ? `, ${a.number}` : ''}`, a.complement].filter(Boolean).join(' – ')
  const second = [a.district, a.city && `${a.city}${a.state ? `/${a.state}` : ''}`, a.postalCode && `CEP ${formatCep(a.postalCode)}`].filter(Boolean).join(' – ')
  return [first, second].filter(Boolean)
}

/** Página pública de rastreio (funciona para Correios e transportadoras do Melhor Envio). */
export const trackingUrl = (code: string) => `https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(code)}`
