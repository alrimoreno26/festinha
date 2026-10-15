import { Balloons, RainbowStripe, Wave } from '@/components/brand/Decor'
import Navbar from '@/components/landing/Navbar'
import { BRAND, instagramUrl, whatsappUrl } from '@/lib/brand'
import { Instagram, Mail, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'

const contacts = [
  { href: instagramUrl, label: `@${BRAND.instagram}`, icon: Instagram, bg: 'bg-brand-sun' },
  { href: `mailto:${BRAND.email}`, label: BRAND.email, icon: Mail, bg: 'bg-brand-sky' },
  { href: whatsappUrl(), label: BRAND.whatsappDisplay, icon: MessageCircle, bg: 'bg-brand-mint' },
]

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <RainbowStripe />
      <Navbar />
      <div className="flex-1">{children}</div>
      <footer className="relative mt-10">
        <Wave color="#FFABE4" />
        <div className="bg-brand-pink">
          <div className="relative max-w-6xl mx-auto px-4 pb-8 pt-2 flex flex-col items-center gap-5 text-center md:flex-row md:text-left md:justify-between">
            <div className="flex items-center gap-4">
              <img src="/brand/selo.png" alt="" className="h-20 w-20 rounded-full ring-4 ring-white/70" />
              <div>
                <p className="font-display text-2xl font-bold text-white [text-shadow:0_1px_2px_rgb(184_47_116/.45)]">{BRAND.fullName}</p>
                <p className="text-sm font-semibold text-brand-ink">{BRAND.tagline.join(' ♥ ')}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-ink">Entre em contato</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm font-semibold text-brand-ink">
                {contacts.map(({ href, label, icon: Icon, bg }) => (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline break-all">
                      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
                        <Icon size={15} />
                      </span>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <Balloons className="hidden lg:block absolute -top-44 right-2" />
          </div>
          <p className="pb-6 text-center text-xs font-semibold text-brand-ink/80">
            © {new Date().getFullYear()} {BRAND.fullName} · Feito com muito carinho 💕
          </p>
          <RainbowStripe />
        </div>
      </footer>
    </div>
  )
}
