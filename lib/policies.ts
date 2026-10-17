// Informações e políticas da loja (texto do catálogo). Mostradas em /informacoes e citadas no checkout.

export interface PolicyItem {
  icon: string
  title?: string
  text: string
}

export interface PolicySection {
  id: string
  title: string
  intro?: string
  items: PolicyItem[]
}

export const POLICIES: PolicySection[] = [
  {
    id: 'pagamento',
    title: 'Formas de pagamento',
    intro: 'No site, o pagamento é feito por Pix ou cartão, com segurança pelo Mercado Pago.',
    items: [
      { icon: '💠', text: 'Pix' },
      { icon: '💳', text: 'Cartão de crédito/débito' },
      { icon: '🏦', text: 'Transferência bancária' },
    ],
  },
  {
    id: 'condicoes',
    title: 'Condições do pedido',
    items: [
      { icon: '💳', title: 'Pagamento', text: 'O valor total do pedido deve ser pago antes do início da produção ou personalização.' },
      {
        icon: '🎨',
        title: 'Personalização',
        text: 'Informe o nome, a idade, as cores, o tema e os demais detalhes desejados no momento da contratação ou em até 48 horas.',
      },
      { icon: '📅', title: 'Prazo de entrega', text: 'Será combinado conforme o modelo escolhido e o tipo de personalização.' },
      {
        icon: '✏️',
        title: 'Alterações',
        text: 'As alterações na arte poderão ser solicitadas em até 48 horas após a aprovação. Após esse prazo, não será possível realizar novas mudanças.',
      },
      { icon: '💌', title: 'Confirmação', text: 'A produção será iniciada após a confirmação do pagamento e a definição de todos os detalhes do pedido.' },
    ],
  },
  {
    id: 'entrega',
    title: 'Entrega',
    items: [
      {
        icon: '💌',
        title: 'Arquivos digitais',
        text: 'Após a confirmação do pagamento, você receberá seu arquivo pelo canal combinado, pronto para baixar, imprimir e montar.',
      },
      { icon: '🎁', title: 'Produtos impressos', text: 'Podem ser retirados no local, em horário previamente combinado.' },
      {
        icon: '📦',
        title: 'Envio pelos Correios ou transportadora',
        text: 'Enviamos para todo o Brasil. O valor do frete e o prazo são calculados no checkout pelo seu CEP, e o prazo começa a contar a partir do envio. Você recebe o código de rastreio por email.',
      },
    ],
  },
  {
    id: 'cancelamento',
    title: 'Cancelamento',
    items: [
      {
        icon: '🕊️',
        title: 'Antes de iniciar a personalização',
        text: 'Se precisar cancelar seu pedido, pedimos que nos avise antes de começarmos a criação.',
      },
      {
        icon: '🎨',
        title: 'Após o início da criação',
        text: 'Como dedicamos tempo e carinho à personalização do seu pedido, o sinal de 50% poderá ser utilizado para cobrir o trabalho já realizado.',
      },
      {
        icon: '✅',
        title: 'Após a finalização da arte',
        text: 'Caso o pedido seja cancelado após a conclusão da criação, o valor referente ao trabalho realizado será mantido.',
      },
    ],
  },
]
