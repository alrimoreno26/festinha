// Layout dos emails transacionais (HTML com estilos inline + versão em texto).
// Tabelas e estilos inline porque é o que os clientes de email (Gmail, Outlook, Apple Mail) entendem bem.

const BRAND = { coral: '#F77F6F', teal: '#4AB6B7', cocoa: '#8D6E63', sand: '#FFF8F1', text: '#2b2b2b', muted: '#6b7280' }

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface EmailContent {
  subject: string
  /** Texto com parágrafos separados por linha em branco; quebras simples viram <br>. */
  body: string
  actionUrl?: string | null
  actionLabel?: string | null
}

/** Transforma um link relativo ("/conta/login") em absoluto com a origem pública do site. */
export function absoluteUrl(url: string, appUrl: string) {
  return /^https?:\/\//.test(url) ? url : `${appUrl.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

export function renderEmail(content: EmailContent, appUrl: string) {
  const action = content.actionUrl ? { url: absoluteUrl(content.actionUrl, appUrl), label: content.actionLabel || 'Abrir' } : null
  const paragraphs = content.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.sand};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.sand};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
        <tr><td style="padding:24px 28px 8px">
          <p style="margin:0;font-size:22px;font-weight:bold;color:${BRAND.coral}">Festinhas</p>
          <p style="margin:2px 0 0;font-size:13px;color:${BRAND.teal}">Criativa Papelaria</p>
        </td></tr>
        <tr><td style="padding:12px 28px 4px">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${BRAND.cocoa}">${escapeHtml(content.subject)}</h1>
          ${paragraphs
            .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
            .join('\n          ')}
        </td></tr>
        ${
          action
            ? `<tr><td style="padding:8px 28px 24px">
          <a href="${escapeHtml(action.url)}" style="display:inline-block;background:${BRAND.coral};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:14px">${escapeHtml(action.label)}</a>
          <p style="margin:14px 0 0;font-size:12px;color:${BRAND.muted}">Se o botão não funcionar, copie este link: <br><a href="${escapeHtml(action.url)}" style="color:${BRAND.teal};word-break:break-all">${escapeHtml(action.url)}</a></p>
        </td></tr>`
            : ''
        }
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #f1ece6">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted}">Você recebeu este email porque comprou ou tem uma conta na Festinhas Criativa Papelaria. Dúvidas? Responda este email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = [content.subject, '', ...paragraphs.flatMap((p) => [p, '']), ...(action ? [`${action.label}: ${action.url}`, ''] : []), '— Festinhas Criativa Papelaria'].join('\n')

  return { html, text }
}
