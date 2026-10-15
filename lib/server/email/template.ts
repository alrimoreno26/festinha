// Layout dos emails transacionais (HTML com estilos inline + versão em texto).
// Tabelas e estilos inline porque é o que os clientes de email (Gmail, Outlook, Apple Mail) entendem bem.

// Mesma identidade do catálogo/site: arco-íris pastel, rosa forte nos botões e roxo escuro nos títulos.
const BRAND = { rose: '#CC3A85', grape: '#6E4FB8', ink: '#4A3360', pink: '#FFABE4', blush: '#FFEAF6', cream: '#FFFAFA', text: '#535353', muted: '#7a6f80' }
const RAINBOW = ['#FFABE4', '#FFC2AF', '#FFDB8A', '#B5E7D5', '#A6DEF5', '#D9C7F5', '#FFCCEF']
const stripe = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${RAINBOW.map((c) => `<td style="height:8px;background:${c};font-size:0;line-height:0">&nbsp;</td>`).join('')}</tr></table>`

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
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:'Open Sans',Arial,Helvetica,sans-serif;color:${BRAND.text}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #ffd6f0">
        <tr><td>${stripe}</td></tr>
        <tr><td style="padding:22px 28px 8px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:12px"><img src="${escapeHtml(absoluteUrl('/brand/selo.png', appUrl))}" width="56" height="56" alt="" style="display:block;border-radius:50%;border:0"></td>
            <td>
              <p style="margin:0;font-size:21px;font-weight:bold;color:${BRAND.rose}">Festinhas Criativas</p>
              <p style="margin:2px 0 0;font-size:13px;font-weight:bold;color:${BRAND.grape}">Sonhe ♥ Personalize ♥ Comemore</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:12px 28px 4px">
          <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${BRAND.ink}">${escapeHtml(content.subject)}</h1>
          ${paragraphs
            .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
            .join('\n          ')}
        </td></tr>
        ${
          action
            ? `<tr><td style="padding:8px 28px 24px">
          <a href="${escapeHtml(action.url)}" style="display:inline-block;background:${BRAND.rose};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:999px">${escapeHtml(action.label)}</a>
          <p style="margin:14px 0 0;font-size:12px;color:${BRAND.muted}">Se o botão não funcionar, copie este link: <br><a href="${escapeHtml(action.url)}" style="color:${BRAND.grape};word-break:break-all">${escapeHtml(action.url)}</a></p>
        </td></tr>`
            : ''
        }
        <tr><td style="padding:16px 28px 20px;background:${BRAND.blush}">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted}">Você recebeu este email porque comprou ou tem uma conta na Festinhas Criativas Papelaria. Dúvidas? Responda este email. 💕</p>
        </td></tr>
        <tr><td>${stripe}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = [content.subject, '', ...paragraphs.flatMap((p) => [p, '']), ...(action ? [`${action.label}: ${action.url}`, ''] : []), '— Festinhas Criativas Papelaria'].join('\n')

  return { html, text }
}
