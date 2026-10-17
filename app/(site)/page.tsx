import { FeaturedKits } from '@/components/landing/FeaturedKits'
import { About, Contact, Gallery, Hero, HowItWorks, Options, Themes } from '@/components/landing/Sections'

const gallery = [
  { src: '/galeria/colecao-festinhas.webp', alt: 'Caixinhas, plaquinhas de mesa e livrinhos de colorir personalizados' },
  { src: '/galeria/caixinhas-personalizadas.webp', alt: 'Caixinhas personalizadas: milk, meia bala, cone e bem-casado' },
  { src: '/galeria/plaquinhas-de-mesa.webp', alt: 'Plaquinhas de mesa personalizadas com nome e idade' },
  { src: '/galeria/tags-personalizadas.webp', alt: 'Tags personalizadas para lembrancinhas' },
  { src: '/galeria/livrinhos-de-colorir.webp', alt: 'Livrinhos de colorir com vários temas' },
  { src: '/galeria/tema-individual.webp', alt: 'Caixinhas de chá revelação com tema de ursinhos' },
  { src: '/galeria/personalizado-digital.webp', alt: 'Caixa milk personalizada com o nome Heloísa, 1 aninho' },
]

export default function Page() {
  return (
    <>
      <Hero />
      <About />
      <HowItWorks />
      <FeaturedKits />
      <Options />
      <Themes />
      <Gallery items={gallery} />
      <Contact />
    </>
  )
}
