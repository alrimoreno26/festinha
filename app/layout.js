import '../styles/globals.css'

export const metadata = { 
  title: 'Festinhas Criativa Papelaria', 
  description: 'Papelaria criativa para festas infantis'
 }
export default function RootLayout({ children }){
  return (
  <html lang="pt-br">
    <body>
      {children}
      </body>
    </html>
  )
}
