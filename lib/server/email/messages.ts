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

/** Resumo da personalização, repetido no email para o cliente conferir. */
function customizationLines(c: { childName: string; age: string; theme: string; colors: string; notes: string } | null) {
  if (!c) return ''
  const lines = [
    c.childName && `Nome: ${c.childName}`,
    c.age && `Idade: ${c.age}`,
    c.theme && `Tema: ${c.theme}`,
    c.colors && `Cores: ${c.colors}`,
    c.notes && `Observações: ${c.notes}`,
  ].filter(Boolean)
  return lines.length ? `\n\nDetalhes que você enviou:\n${lines.join('\n')}` : ''
}

/**
 * Pedido sob encomenda (personalizado digital ou impresso) pago: vamos começar a produção.
 * Quem ainda não tinha conta recebe a senha temporária para acompanhar pela Área do Cliente.
 */
export function orderReceived(p: {
  name: string
  email: string
  tempPassword: string | null
  kit: string
  printed: boolean
  customization: Parameters<typeof customizationLines>[0]
}): EmailMessage {
  const next = p.printed
    ? 'Vamos produzir tudo com muito carinho e avisamos por email quando estiver pronto para retirada ou quando for enviado (com o código de rastreio).'
    : 'Vamos criar sua arte com muito carinho e avisamos por email quando o arquivo estiver pronto para baixar na sua Área do Cliente.'
  const access = p.tempPassword
    ? `\n\nAcompanhe seu pedido na Área do Cliente com:\nEmail: ${p.email}\nSenha temporária: ${p.tempPassword}`
    : ''
  return {
    subject: `Recebemos seu pedido: ${p.kit} 💕`,
    body: `Olá, ${p.name}! Seu pagamento foi confirmado. ${next}${customizationLines(p.customization)}\n\nSe quiser completar ou ajustar algum detalhe, você tem até 48 horas: é só responder este email ou chamar no WhatsApp.${access}`,
    actionUrl: p.tempPassword ? '/conta/login' : '/conta/pedidos',
    actionLabel: 'Acompanhar pedido',
  }
}

/** Arte do personalizado digital enviada pelo admin. */
export function customReady(p: { name: string; kit: string }): EmailMessage {
  return {
    subject: `Sua arte personalizada está pronta! 🎉`,
    body: `Olá, ${p.name}! Seu ${p.kit} ficou pronto. Os arquivos já estão disponíveis para baixar na sua Área do Cliente, em Pedidos.`,
    actionUrl: '/conta/pedidos',
    actionLabel: 'Baixar meus arquivos',
  }
}

/** Kit impresso pronto para retirada. */
export function printedReady(p: { name: string; kit: string }): EmailMessage {
  return {
    subject: `Seu ${p.kit} está pronto! 🎉`,
    body: `Olá, ${p.name}! Seu pedido está pronto para retirada. Vamos chamar você no WhatsApp para combinar o melhor horário.`,
    actionUrl: '/conta/pedidos',
    actionLabel: 'Ver meu pedido',
  }
}

/** Kit impresso despachado pelos Correios/transportadora. */
export function printedShipped(p: { name: string; kit: string; carrier: string; trackingCode: string | null; trackingUrl: string | null }): EmailMessage {
  const tracking = p.trackingCode ? `\n\nCódigo de rastreio: ${p.trackingCode}` : ''
  return {
    subject: `Seu ${p.kit} foi enviado! 📦`,
    body: `Olá, ${p.name}! Seu pedido já está a caminho${p.carrier ? ` pela ${p.carrier}` : ''}.${tracking}\n\nO prazo começa a contar a partir de agora, em dias úteis.`,
    actionUrl: p.trackingUrl ?? '/conta/pedidos',
    actionLabel: p.trackingUrl ? 'Rastrear pedido' : 'Ver meu pedido',
  }
}
