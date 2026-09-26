# Festinhas Criativa Papelaria — Next.js 14 + TypeScript + Tailwind

Landing page + venda de kits digitais "pega e monta" com backoffice e área do cliente.

## Rodar local
```bash
npm install
npm run dev
```
Abre http://localhost:3000

## Fase atual: frontend com dados simulados
Toda a lógica roda no navegador sobre um banco simulado (`localStorage`). Nenhuma integração
(Postgres, R2, Mercado Pago, email) está ligada ainda.

- **DevToolbar** (botão "Dev" no canto inferior esquerdo): trocar de sessão, forçar o resultado
  do pagamento, simular rede lenta/erro, restaurar ou esvaziar os dados e ver os emails "enviados".
- **/dev**: vitrine dos componentes base.
- Contas de teste: ver `SEED_ACCOUNTS` em `lib/mock/seed.ts`.
- Para esconder a DevToolbar: `NEXT_PUBLIC_DEVTOOLS=false`.

## Estrutura
```
app/
  (site)/          landing
  conta/           área do cliente (login público, resto protegido)
  admin/           backoffice
  dev/             vitrine de componentes
components/
  ui/              componentes base (Button, Field, Modal, Table, Toast…)
  landing/         seções da landing
  dev/             DevToolbar
lib/
  types.ts         tipos de domínio
  services/        ÚNICO acesso a dados da UI (hoje usa o mock; depois, a API)
  mock/            banco simulado, seed e regras de liberação de acesso
```

A UI nunca importa de `lib/mock` — só de `lib/services`. Nas próximas fases os serviços passam a
chamar a API mantendo as mesmas assinaturas.

## Deploy na Vercel
- Faça push para GitHub (repo novo)
- Em vercel.com → Add New Project → Import Git Repository
- Vercel detecta Next.js automaticamente → Deploy
