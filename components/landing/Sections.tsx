'use client'
import { Balloons, Bunting, SectionTitle, StepBadge } from '@/components/brand/Decor'
import { buttonClasses } from '@/components/ui'
import { BRAND, instagramUrl, whatsappUrl } from '@/lib/brand'
import { motion } from 'framer-motion'
import { Heart, Instagram, Mail, MapPin, MessageCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'

const fadeUp = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.5 } }

export function Hero() {
  return (
    <section id="hero" className="relative overflow-hidden confetti">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center md:text-left">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-brand-rose shadow-sm ring-1 ring-brand-pink/40">
            {BRAND.tagline.map((w, i) => (
              <span key={w} className="inline-flex items-center gap-2">
                {i > 0 && <Heart size={12} className="fill-brand-sun text-brand-sun" />}
                {w}
              </span>
            ))}
          </p>
          <h1 className="mt-5 text-4xl md:text-6xl font-bold leading-[1.05] text-brand-ink">
            Transformando festas simples em <span className="text-rainbow">celebrações inesquecíveis</span>
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed">
            Kits digitais, artes personalizadas e papelaria impressa para aniversários, chás e datas especiais. Escolha, conte como você quer e monte sua festa do seu jeitinho. 💕
          </p>
          <div className="mt-7 flex flex-wrap justify-center md:justify-start gap-3">
            <Link href="/pacotes" className={buttonClasses('primary', 'lg')}>
              <Sparkles size={18} /> Ver os kits
            </Link>
            <Link href="/pacotes?tipo=custom_digital" className={buttonClasses('outline', 'lg')}>
              Quero um kit personalizado
            </Link>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
          <img
            src="/brand/logo.webp"
            alt={`${BRAND.fullName} — ${BRAND.tagline.join(', ')}`}
            className="w-full max-w-md mx-auto rounded-[2.5rem] shadow-xl shadow-brand-pink/30 ring-8 ring-white"
          />
          <Balloons className="absolute -bottom-6 -right-2 md:-right-8 animate-float" />
        </motion.div>
      </div>
    </section>
  )
}

export function About() {
  return (
    <section id="quem-somos" className="py-14 md:py-20">
      <Bunting className="max-w-5xl mx-auto -mt-6 mb-6 px-4" />
      <div className="max-w-5xl mx-auto px-4">
        <SectionTitle>Quem somos?</SectionTitle>
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-6">
          <motion.div {...fadeUp} className="rounded-[2.5rem] bg-brand-lilac/60 p-6 md:p-8 text-center md:text-left leading-relaxed space-y-4">
            <p>
              A <strong className="text-brand-ink">Festinhas Criativas</strong> é um cantinho cheio de cor, carinho e imaginação, criado para transformar momentos
              especiais em lembranças inesquecíveis.
            </p>
            <p>
              Acreditamos que cada comemoração merece ser única, bonita e cheia de personalidade. Por isso trabalhamos com arquivos digitais e impressão de
              papelaria personalizada para festas, preparados com muito cuidado e atenção a cada detalhe.
            </p>
            <p>✨ Aniversários, chás, comemorações infantis e diversas datas especiais — do seu jeitinho.</p>
          </motion.div>
          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="card-dashed p-6 md:p-8">
            <p className="font-display text-2xl font-bold text-brand-rose">Quem sou eu?</p>
            <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-brand-grape">Lisandra</p>
            <p className="mt-4 leading-relaxed">
              Sou a criadora da Festinhas Criativas, um projeto que nasceu do amor pelo meu filho e das comemorações que vivi ao lado dele. Hoje transformo esse
              amor em criações para ajudar outras famílias a celebrar com beleza, criatividade e praticidade. 💕
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const steps = [
  { title: 'Escolha o seu kit', desc: 'Kit digital pronto, arte personalizada ou papelaria impressa.' },
  { title: 'Conte os detalhes', desc: 'Nos personalizados, informe nome, idade, tema e cores no próprio pedido.' },
  { title: 'Pague com Pix ou cartão', desc: 'Pagamento seguro pelo Mercado Pago. O Pix é confirmado na hora.' },
  { title: 'Receba', desc: 'Kit pronto: download na hora. Personalizado: a arte na sua Área do Cliente. Impresso: retirada ou envio com rastreio.' },
  { title: 'Recorte e monte', desc: 'Caixinhas, tags, plaquinhas e lembrancinhas prontas para montar.' },
  { title: 'Faça uma linda festa!', desc: 'Agora é só celebrar e guardar as lembranças. 🎉' },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative">
      <div className="bg-brand-pink">
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold uppercase text-white [text-shadow:0_2px_0_rgb(204_58_133/.35)]">Como funciona?</h2>
          <p className="mt-2 font-semibold text-brand-ink">O que você precisa fazer é muito simples</p>
        </div>
      </div>
      <div aria-hidden className="scallops text-brand-pink" />
      <div className="max-w-5xl mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
        {steps.map((s, i) => (
          <motion.div key={s.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.05 * i }} className="flex gap-4">
            <StepBadge n={i + 1} />
            <div>
              <p className="font-display text-xl font-semibold text-brand-rose uppercase">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

const options = [
  {
    n: 1,
    title: 'Kits digitais prontos',
    desc: 'Arquivos prontos para baixar, imprimir e montar. Pague aqui no site e receba o acesso na hora.',
    cta: { label: 'Ver kits digitais', href: '/pacotes?tipo=digital' },
  },
  {
    n: 2,
    title: 'Kit personalizado',
    desc: 'Personalizamos cada detalhe com o nome, idade, cores e o tema da sua festa. Você conta como quer no pedido e recebe o arquivo na Área do Cliente.',
    cta: { label: 'Ver personalizados', href: '/pacotes?tipo=custom_digital' },
  },
  {
    n: 3,
    title: 'Impressão',
    desc: 'Caixinhas, plaquinhas, tags e livrinhos impressos com capricho. Retirada no local ou envio para todo o Brasil.',
    cta: { label: 'Ver impressos', href: '/pacotes?tipo=printed' },
  },
]

export function Options() {
  return (
    <section id="servicos" className="py-14 md:py-20 bg-white/70">
      <div className="max-w-6xl mx-auto px-4">
        <SectionTitle subtitle="Encontre a opção ideal para você: kits completos, personalizados ou impressos, prontos para transformar suas ideias em lindas criações.">
          Opções de kits
        </SectionTitle>
        <div className="grid md:grid-cols-3 gap-6">
          {options.map((o) => (
            <motion.div key={o.title} {...fadeUp} className="card-dashed p-6 flex flex-col">
              <div className="flex items-center gap-3">
                <StepBadge n={o.n} className="h-11 w-11 text-xl" />
                <p className="font-display text-xl font-bold text-brand-ink uppercase">{o.title}</p>
              </div>
              <p className="mt-4 text-sm leading-relaxed flex-1">{o.desc}</p>
              <a
                href={o.cta.href}
                {...(o.cta.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                className={buttonClasses(o.n === 1 ? 'primary' : 'secondary', 'md', 'mt-5 self-start')}
              >
                {o.cta.label}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const themes = [
  { icon: '🎀', title: 'Personagens e desenhos', desc: 'Os personagens e animações favoritos das crianças.' },
  { icon: '🦄', title: 'Encantados e fantasia', desc: 'Princesas, unicórnios, sereias, fadas e magia.' },
  { icon: '🦖', title: 'Aventura e diversão', desc: 'Dinossauros, super-heróis, piratas, safári e fazendinha.' },
  { icon: '🚗', title: 'Carros e transportes', desc: 'Carros, caminhões, aviões, trens e construção.' },
  { icon: '🌸', title: 'Delicados e fofos', desc: 'Flores, borboletas, bichinhos, arco-íris e ursinhos.' },
  { icon: '🎂', title: 'Todas as idades', desc: 'Do batizado e primeiro aninho às festas de adultos.' },
]
const themeBg = ['bg-brand-pink/40', 'bg-brand-lilac/60', 'bg-brand-mint/60', 'bg-brand-sky/50', 'bg-brand-peach/50', 'bg-brand-sun/50']

export function Themes() {
  return (
    <section id="temas" className="py-14 md:py-20">
      <div className="max-w-6xl mx-auto px-4">
        <SectionTitle subtitle="Uma grande variedade de temas para diferentes idades, estilos e ocasiões.">Temas para todos os momentos</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((t, i) => (
            <motion.div key={t.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.04 * i }} className={`rounded-3xl p-5 ${themeBg[i]}`}>
              <p className="text-3xl" aria-hidden>
                {t.icon}
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-brand-ink">{t.title}</p>
              <p className="mt-1 text-sm">{t.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export type GalleryItem = { src: string; alt?: string }

export function Gallery({ items = [] }: { items?: GalleryItem[] }) {
  return (
    <section id="galeria" className="py-14 md:py-20 bg-white/70">
      <div className="max-w-6xl mx-auto px-4">
        <SectionTitle subtitle="Alguns trabalhos e materiais feitos com carinho.">Galeria</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((g, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.05 * idx }}
              className="overflow-hidden rounded-3xl bg-white ring-4 ring-white shadow-sm shadow-brand-pink/30"
            >
              <img src={g.src} alt={g.alt || 'Galeria Festinhas Criativas'} className="aspect-square w-full object-cover hover:scale-105 transition-transform duration-300" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Contact() {
  return (
    <section id="contato" className="py-14 md:py-20">
      <div className="max-w-4xl mx-auto px-4">
        <SectionTitle subtitle="Nossa coleção está sempre crescendo! Se você já tem um tema em mente, fale com a gente e encontramos uma criação que combine com a sua festa. 🎉">
          Não encontrou o seu tema?
        </SectionTitle>
        <div className="rounded-[2.5rem] bg-brand-blush p-6 md:p-10 grid md:grid-cols-2 gap-6 items-center ring-1 ring-brand-pink/30">
          <ul className="space-y-4 text-[15px]">
            <li className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-mint text-brand-ink">
                <MessageCircle size={18} />
              </span>
              {BRAND.whatsappDisplay}
            </li>
            <li className="flex items-center gap-3 min-w-0">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-peach text-brand-ink">
                <Mail size={18} />
              </span>
              <a href={`mailto:${BRAND.email}`} className="truncate hover:underline">
                {BRAND.email}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-sun text-brand-ink">
                <Instagram size={18} />
              </span>
              @{BRAND.instagram}
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-sky text-brand-ink">
                <MapPin size={18} />
              </span>
              {BRAND.city}
            </li>
          </ul>
          <div className="flex flex-col gap-3">
            <a href={whatsappUrl('Olá! Vim pelo site da Festinhas Criativas 💕')} target="_blank" rel="noreferrer" className={buttonClasses('primary', 'lg')}>
              <MessageCircle size={18} /> Chamar no WhatsApp
            </a>
            <a href={instagramUrl} target="_blank" rel="noreferrer" className={buttonClasses('secondary', 'lg')}>
              <Instagram size={18} /> Ver o Instagram
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

const businessItems = [
  { icon: '📤', title: 'Envie o seu design', desc: 'Arquivo pronto em PDF ou imagem em alta resolução, frente e verso.' },
  { icon: '🧮', title: '9 cartões por folha', desc: 'Em cada folha A4 cabem 9 cartões. Até 49 unidades, R$ 6,00 por folha.' },
  { icon: '🖨️', title: 'Imprimimos com capricho', desc: 'Cartões de visita, de agradecimento, de garantia, de cuidados e mais.' },
  { icon: '📦', title: 'Retire ou receba', desc: 'Retirada no local ou envio para todo o Brasil, com rastreio.' },
]

/** Linha "Para empresas": papelaria com a identidade de outros negócios (cartões, tags, etiquetas). */
export function Business() {
  return (
    <section id="empresas" className="relative py-14 md:py-20">
      <div className="max-w-6xl mx-auto px-4">
        <SectionTitle subtitle="Impressão de cartões de apresentação para o seu negócio: você envia o design pronto e nós imprimimos. A partir de 50 cartões, pacotes com preço especial.">
          Impressão de cartões
        </SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {businessItems.map((b, i) => (
            <motion.div key={b.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.05 * i }} className="card-dashed p-5">
              <p className="text-3xl" aria-hidden>
                {b.icon}
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-brand-ink">{b.title}</p>
              <p className="mt-1 text-sm">{b.desc}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/pacotes?linha=empresas" className={buttonClasses('primary', 'lg')}>
            Imprimir meus cartões
          </Link>
          <a href={whatsappUrl('Olá! Quero imprimir cartões de apresentação.')} target="_blank" rel="noreferrer" className={buttonClasses('outline', 'lg')}>
            <MessageCircle size={18} /> Pedir orçamento
          </a>
        </div>
      </div>
    </section>
  )
}
