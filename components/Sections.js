'use client'
import { motion } from 'framer-motion'
import { Star, Sparkles, Phone, Mail, MapPin, Instagram, MessageCircle } from 'lucide-react'
import { palette } from './Palette'

const benefits = [
  { title: 'Design exclusivo', desc: 'Cores, tipografias e personagens criados para você.' },
  { title: 'Acabamento premium', desc: 'Papéis especiais, cortes precisos, foil e detalhes.' },
  { title: 'Kits completos', desc: 'Convites, toppers, bandeirinhas, adesivos e lembrancinhas.' },
  { title: 'Entrega pontual', desc: 'Acompanhamos cada etapa para chegar a tempo.' },
]
const services = [
  { title:'Identidade visual para festas', desc:'Criamos o conceito do seu evento: paleta, tipografias e personagens.' },
  { title:'Papelaria personalizada', desc:'Convites, toppers, bandeirinhas, plaquinhas e adesivos.' },
  { title:'Embalagens & lembrancinhas', desc:'Caixinhas, tags e sacolinhas combinando com o tema.' },
]

export function Hero(){
  return (
    <section id="hero" className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.6}}>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4" style={{color: palette.brown}}>
            Papelaria criativa para <span style={{color: palette.coral}}>celebrações únicas</span>.
          </h1>
          <p className="text-[17px] text-gray-700 mb-6">
            Transformamos sua festa com kits personalizados: convites, toppers, bandeirinhas, adesivos e embalagens. Tudo feito com carinho no seu estilo.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#servicos" className="px-5 py-3 rounded-2xl shadow-md font-medium" style={{background: palette.teal, color: 'white'}}>Ver serviços</a>
            <a href="#contato" className="px-5 py-3 rounded-2xl font-medium border" style={{borderColor: palette.coral, color: palette.coral}}>Pedir orçamento</a>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-600"><Sparkles size={18}/><span>Feito com amor em cada detalhe</span></div>
        </motion.div>
        <motion.div initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} transition={{duration:.6, delay:.1}} className="relative">
          <div className="relative bg-white/70 backdrop-blur rounded-3xl p-6 shadow-lg border">
            <img src="/logo-festinhas.png" alt="Logo preview" className="w-full max-w-sm mx-auto"/>
            <p className="text-center text-sm mt-2 text-gray-500">Festinhas Criativa Papelaria</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export function Benefits(){
  return (
    <section className="py-10 bg-white/70 border-y">
      <div className="max-w-6xl mx-auto px-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {benefits.map((b,i)=> (
          <div key={i} className="bg-white rounded-2xl p-5 border shadow-sm">
            <p className="font-semibold mb-1" style={{color: palette.brown}}>{b.title}</p>
            <p className="text-sm text-gray-600">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Services(){
  return (
    <section id="servicos" className="py-16 md:py-24 bg-white/60 border-y">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10" style={{color: palette.brown}}>Serviços</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {services.map((s,i)=> (
            <div key={i} className="bg-white rounded-3xl p-6 border shadow-sm">
              <div className="flex items-center gap-1 text-yellow-500 mb-3"><Star size={16}/><Star size={16}/><Star size={16}/></div>
              <p className="font-semibold mb-1" style={{color: palette.coral}}>{s.title}</p>
              <p className="text-gray-600 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Gallery({items=[]}){
  return (
    <section id="galeria" className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-2" style={{color: palette.brown}}>Galeria</h2>
        <p className="text-center text-gray-600 mb-10">Alguns trabalhos e materiais promocionais.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((g,idx)=> (
            <motion.div key={idx} initial={{opacity:0}} whileInView={{opacity:1}} viewport={{once:true}} transition={{duration:.4, delay:.05*idx}} className="overflow-hidden rounded-2xl shadow-sm bg-white">
              <img src={g.src} alt={g.alt || 'Galeria Festinhas'} className="h-44 md:h-56 w-full object-cover hover:scale-105 transition-transform duration-300"/>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Contact(){
  return (
    <section id="contato" className="py-16 md:py-24 bg-white/60 border-t">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-2" style={{color: palette.brown}}>Contato</h2>
        <p className="text-center text-gray-600 mb-8">Fale com a gente e vamos planejar sua papelaria ✨</p>
        <div className="grid md:grid-cols-2 gap-8">
          <form onSubmit={(e)=>e.preventDefault()} className="bg-white rounded-3xl p-6 shadow-sm border">
            <label className="block text-sm mb-2">Nome</label>
            <input className="w-full mb-4 px-4 py-3 rounded-2xl border outline-none focus:ring" placeholder="Seu nome" />
            <label className="block text-sm mb-2">Email</label>
            <input type="email" className="w-full mb-4 px-4 py-3 rounded-2xl border outline-none focus:ring" placeholder="voce@email.com" />
            <label className="block text-sm mb-2">Mensagem</label>
            <textarea className="w-full mb-6 px-4 py-3 rounded-2xl border outline-none focus:ring" rows={4} placeholder="Quero um kit para..." />
            <button className="w-full px-5 py-3 rounded-2xl font-semibold shadow" style={{background: palette.coral, color: 'white'}}>Enviar</button>
            <p className="text-xs text-gray-500 mt-3">* Formulário demonstrativo.</p>
          </form>
          <div className="bg-white rounded-3xl p-6 shadow-sm border">
            <div className="flex items-center gap-3 mb-4"><Phone size={18}/><span>+55 48 99105-6244</span></div>
            <div className="flex items-center gap-3 mb-4"><Mail size={18}/><span>papeleriafestinhacreatina@gmail.com</span></div>
            <div className="flex items-center gap-3 mb-6"><MapPin size={18}/><span>Florianópolis – Ingleses</span></div>
            <a href="https://wa.me/5548991056244" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl mr-3" style={{background: palette.teal, color: 'white'}}><MessageCircle size={18}/> WhatsApp</a>
            <a href="https://instagram.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl" style={{background: palette.coral, color: 'white'}}><Instagram size={18}/> Instagram</a>
          </div>
        </div>
      </div>
    </section>
  )
}
