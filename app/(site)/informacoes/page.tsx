import { SectionTitle } from '@/components/brand/Decor'
import { buttonClasses } from '@/components/ui'
import { whatsappUrl } from '@/lib/brand'
import { POLICIES } from '@/lib/policies'
import { MessageCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Informações e políticas · Festinhas Criativas Papelaria',
  description: 'Formas de pagamento, condições do pedido, entrega e cancelamento.',
}

const cardBg = ['bg-brand-pink/30', 'bg-brand-lilac/50', 'bg-brand-mint/50', 'bg-brand-peach/40']

export default function InformacoesPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 md:py-16">
      <SectionTitle subtitle="Para que tudo aconteça de forma tranquila e organizada, confira nossas condições antes de realizar seu pedido. 💕">
        Informações
      </SectionTitle>

      <nav aria-label="Seções" className="mb-10 flex flex-wrap justify-center gap-2">
        {POLICIES.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-ink ring-1 ring-brand-pink/40 hover:bg-brand-blush"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {POLICIES.map((section, i) => (
          <section key={section.id} id={section.id} className={`scroll-mt-24 rounded-[2rem] p-6 md:p-8 ${cardBg[i % cardBg.length]}`}>
            <h2 className="text-2xl md:text-3xl font-bold text-brand-ink">{section.title}</h2>
            {section.intro && <p className="mt-2 text-sm">{section.intro}</p>}
            <ul className="mt-5 space-y-4">
              {section.items.map((item) => (
                <li key={item.text} className="flex gap-3">
                  <span aria-hidden className="text-xl leading-6">
                    {item.icon}
                  </span>
                  <p className="leading-relaxed">
                    {item.title && <strong className="text-brand-ink">{item.title}: </strong>}
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm">Ficou alguma dúvida?</p>
        <a href={whatsappUrl('Olá! Tenho uma dúvida sobre as condições do pedido.')} target="_blank" rel="noreferrer" className={buttonClasses('primary', 'lg', 'mt-3')}>
          <MessageCircle size={18} /> Fale com a gente
        </a>
      </div>
    </main>
  )
}
