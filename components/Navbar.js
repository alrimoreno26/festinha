import Link from 'next/link'
import { palette } from './Palette'
export default function Navbar(){
  const Item = ({label, href}) => (<a href={href} className="hover:opacity-80">{label}</a>)
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-[#FFF8F1]/80 border-b border-amber-100">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-festinhas.png" className="h-12 w-12 object-contain" alt="Festinhas" />
          <div>
            <p className="text-xl font-bold" style={{color: palette.coral}}>Festinhas</p>
            <p className="text-sm -mt-1" style={{color: palette.teal}}>Criativa Papelaria</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Item label="Início" href="#hero" />
          <Item label="Serviços" href="#servicos" />
          <Item label="Galeria" href="#galeria" />
          <Item label="Contato" href="#contato" />
          <a href="#contato" className="px-4 py-2 rounded-2xl shadow-sm" style={{background: palette.coral, color: 'white'}}>Pedir orçamento</a>
        </nav>
      </div>
    </header>
  )
}
