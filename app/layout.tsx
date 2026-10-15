import type { Metadata } from 'next'
import { Fredoka, Open_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
import '../styles/globals.css'
import { Providers } from './providers'

// Títulos arredondados (próximos do "Lovely Summer" do catálogo) e corpo em Open Sans, como no catálogo.
const display = Fredoka({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' })
const sans = Open_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  title: 'Festinhas Criativas Papelaria',
  description: 'Sonhe, personalize, comemore. Kits digitais e papelaria personalizada para festas.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-br" className={`${display.variable} ${sans.variable}`}>
      <body className="bg-brand-cream text-brand-text font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
