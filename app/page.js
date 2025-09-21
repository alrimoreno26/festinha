import Navbar from '../components/Navbar'
import { Hero, Benefits, Services, Gallery, Contact } from '../components/Sections'

const gallery = [
  { src: '/galeria/pacote-completo.png', alt: 'Pacote completo' },
  { src: '/galeria/pacote-individuais-01.png', alt: 'Pacote individuais 1' },
  { src: '/galeria/pacote-individuais-02.jpg', alt: 'Pacote individuais 2' },
  { src: '/galeria/cartaz-papelaria-1.png', alt: 'Cartaz 1' },
  { src: '/galeria/cartaz-papelaria-2.png', alt: 'Cartaz 2' },
]

export default function Page(){
  return (
    <div className="min-h-screen bg-[#FFF8F1] text-[#2b2b2b] font-sans">
      <Navbar />
      <Hero />
      <Benefits />
      <Services />
      <Gallery items={gallery} />
      <Contact />
      <footer className="py-10 text-center text-sm text-gray-500">© {new Date().getFullYear()} Festinhas Criativa Papelaria · Feito com amor</footer>
    </div>
  )
}
