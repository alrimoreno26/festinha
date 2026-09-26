import { FeaturedKits } from '@/components/landing/FeaturedKits'
import { Benefits, Contact, Gallery, Hero, Services } from '@/components/landing/Sections'

const gallery = [
  { src: '/galeria/pacote-completo.png', alt: 'Pacote completo' },
  { src: '/galeria/pacote-individuais-01.png', alt: 'Pacote individuais 1' },
  { src: '/galeria/pacote-individuais-02.jpg', alt: 'Pacote individuais 2' },
  { src: '/galeria/cartaz-papelaria-1.png', alt: 'Cartaz 1' },
  { src: '/galeria/cartaz-papelaria-2.png', alt: 'Cartaz 2' },
]

export default function Page() {
  return (
    <>
      <Hero />
      <Benefits />
      <FeaturedKits />
      <Services />
      <Gallery items={gallery} />
      <Contact />
    </>
  )
}
