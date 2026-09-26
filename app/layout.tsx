import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../styles/globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Festinhas Criativa Papelaria',
  description: 'Papelaria criativa para festas infantis',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-br">
      <body className="bg-brand-sand text-[#2b2b2b] font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
