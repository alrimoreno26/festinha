// Checkout: arquivos do cliente (ex.: logo). Vão direto para o bucket com URL assinada.

import { CUSTOMER_UPLOAD_TYPES, MAX_CUSTOMER_UPLOAD_BYTES, type CustomerUploadTicket } from '@/lib/contracts'
import { ServiceError } from './errors'
import { api } from './http'

export const uploadsService = {
  /** Envia o arquivo e devolve o comprovante (id + token) para anexar ao pedido. */
  upload: async (file: File): Promise<{ id: string; token: string }> => {
    const mime = file.type || 'application/octet-stream'
    if (!CUSTOMER_UPLOAD_TYPES.includes(mime)) throw new ServiceError('VALIDATION', 'Envie uma imagem (PNG, JPG, WEBP ou SVG) ou um PDF.')
    if (file.size > MAX_CUSTOMER_UPLOAD_BYTES) throw new ServiceError('VALIDATION', 'O arquivo pode ter até 15 MB.')
    const ticket = await api<CustomerUploadTicket>('POST', '/api/uploads', { filename: file.name, size: file.size, mime })
    if (ticket.uploadUrl) {
      const res = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: file }).catch(() => null)
      if (!res?.ok) throw new ServiceError('NETWORK', 'Não foi possível enviar o arquivo. Verifique a conexão e tente de novo.')
    }
    return { id: ticket.id, token: ticket.token }
  },
}
