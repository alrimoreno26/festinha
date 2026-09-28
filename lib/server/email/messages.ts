// Textos de todos os emails transacionais, num só lugar. O layout (cores, botão, rodapé) fica em template.ts.
// Cada função devolve assunto, corpo (parágrafos separados por linha em branco) e o botão de ação.

export interface EmailMessage {
  subject: string
  body: string
  actionUrl: string
  actionLabel: string
}

/** Compra aprovada de quem ainda não tinha conta: vai com a senha temporária. */
export function purchaseNewCustomer(p: { name: string; email: string; tempPassword: string; kit: string }): EmailMessage {
  return {
    subject: `Seu ${p.kit} está liberado! 🎉`,
    body: `Olá, ${p.name}! Seu pagamento foi confirmado.\n\nAcesse a Área do Cliente com:\nEmail: ${p.email}\nSenha temporária: ${p.tempPassword}\n\nNo primeiro acesso você vai criar sua própria senha.`,
    actionUrl: '/conta/login',
    actionLabel: 'Acessar meus kits',
  }
}

/** Compra aprovada de quem já tinha conta. */
export function purchaseExistingCustomer(p: { name: string; kit: string }): EmailMessage {
  return {
    subject: `Seu ${p.kit} está liberado! 🎉`,
    body: `Olá, ${p.name}! Seu pagamento foi confirmado e o ${p.kit} já está na sua conta. Entre com seu email e senha de sempre.`,
    actionUrl: '/conta/login',
    actionLabel: 'Acessar meus kits',
  }
}

/** "Esqueci minha senha". */
export function passwordReset(p: { name: string; token: string }): EmailMessage {
  return {
    subject: 'Redefinir sua senha',
    body: `Olá, ${p.name}! Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.\n\nSe não foi você, ignore este email.`,
    actionUrl: `/conta/redefinir-senha?token=${p.token}`,
    actionLabel: 'Criar nova senha',
  }
}

/** Conta criada manualmente pelo admin (ex.: venda pelo WhatsApp). */
export function accountCreated(p: { name: string; email: string; tempPassword: string }): EmailMessage {
  return {
    subject: 'Sua conta na Festinhas foi criada',
    body: `Olá, ${p.name}! Criamos sua conta na Área do Cliente.\n\nEmail: ${p.email}\nSenha temporária: ${p.tempPassword}`,
    actionUrl: '/conta/login',
    actionLabel: 'Acessar',
  }
}

/** Kit liberado manualmente pelo admin (brinde, venda por fora…). */
export function accessGranted(p: { name: string; kit: string }): EmailMessage {
  return {
    subject: `Você ganhou acesso ao ${p.kit}`,
    body: `Olá, ${p.name}! O ${p.kit} já está disponível na sua Área do Cliente.`,
    actionUrl: '/conta',
    actionLabel: 'Ver meus kits',
  }
}

/** Admin reenviou os dados de acesso (nova senha temporária). */
export function accessResent(p: { name: string; email: string; tempPassword: string }): EmailMessage {
  return {
    subject: 'Seus dados de acesso',
    body: `Olá, ${p.name}! Aqui estão seus novos dados de acesso.\n\nEmail: ${p.email}\nSenha temporária: ${p.tempPassword}`,
    actionUrl: '/conta/login',
    actionLabel: 'Acessar meus kits',
  }
}
