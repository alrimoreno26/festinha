# Festinhas Criativa Papelaria — Next.js 14 + TypeScript + Tailwind

Landing page + venda de kits digitais "pega e monta" com backoffice e área do cliente.

## Rodar local
```bash
npm install
npm run dev
```
Abre http://localhost:3000

## Banco de dados (Neon + Drizzle)
1. Copie `.env.example` para `.env.local` e preencha com as URLs da branch **dev** da Neon.
2. Comandos:
```bash
npm run db:ping       # testa a conexão
npm run db:generate   # gera migração a partir de lib/server/db/schema.ts
npm run db:migrate    # aplica migrações pendentes
npm run db:seed       # APAGA e recria os dados de exemplo (só dev)
npm run db:studio     # abre o Drizzle Studio para ver as tabelas
npm run admin:create -- --email voce@exemplo.com --name "Seu Nome"   # cria/promove admin (pede a senha)
```
Migrações ficam em `drizzle/` e vão para o git.

## Testes
```bash
npm test              # regras de negócio (lib/server/domain) contra um Postgres em memória (PGlite)
```
Os testes aplicam as migrações de `drizzle/` e usam os dados do seed — não tocam na Neon.

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
