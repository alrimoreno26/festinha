// Dados públicos da marca, usados no site (rodapé, contato) — mesmos do catálogo.
export const BRAND = {
  name: 'Festinhas Criativas',
  fullName: 'Festinhas Criativas Papelaria',
  tagline: ['Sonhe', 'Personalize', 'Comemore'],
  instagram: 'papelariafestinhascriativas',
  email: 'papelariafestinhascreativa@gmail.com',
  whatsappDisplay: '(48) 99105-6244',
  whatsappNumber: '5548991056244',
  city: 'Florianópolis – Ingleses',
} as const

export const instagramUrl = `https://instagram.com/${BRAND.instagram}`
export const whatsappUrl = (text?: string) => `https://wa.me/${BRAND.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`
