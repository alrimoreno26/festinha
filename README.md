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
npm run db:seed       # APAGA e recria os dados de exemplo (só dev; com R2 configurado não cria arquivos fictícios)
npm run db:studio     # abre o Drizzle Studio para ver as tabelas
npm run admin:create -- --email voce@exemplo.com --name "Seu Nome"   # cria/promove admin (pede a senha)
```
Migrações ficam em `drizzle/` e vão para o git.

## Arquivos (Cloudflare R2)
Com as variáveis `R2_*` (ver `.env.example`) os arquivos ficam no R2; sem elas, modo demonstração.
O painel mostra os arquivos **registrados no banco**: o que for enviado pelo painel da Cloudflare aparece
depois de **Arquivos → Sincronizar com o bucket**, que também oferece remover registros cujo arquivo não
existe mais no bucket. Pastas criadas/excluídas no painel também são criadas/excluídas no bucket.

## Testes
```bash
npm test              # regras de negócio (lib/server/domain) contra um Postgres em memória (PGlite)
```
Os testes aplicam as migrações de `drizzle/` e usam os dados do seed — não tocam na Neon.

## Emails (Resend)
Os emails são gravados na `email_outbox` junto com a operação que os gera e enviados pelo Resend logo depois
(em segundo plano), com até 5 tentativas. Sem `RESEND_API_KEY` ficam só registrados (DevToolbar → Emails).
Em desenvolvimento/preview use `EMAIL_TO_OVERRIDE` para que tudo vá para o seu email.

## Modo de simulação (até as fases 3–5)
Dados, login e regras já são reais (Neon). Continuam simulados: pagamento (simulador no lugar do
Mercado Pago), conteúdo dos arquivos (R2) e envio de emails (ficam na tabela `email_outbox`).

- **DevToolbar** (botão "Dev"): resultado do próximo pagamento, rede lenta/erro, entrar como conta
  de teste sem senha, restaurar/esvaziar o banco de desenvolvimento e ver os emails "enviados".
- **/dev**: vitrine dos componentes base.
- Contas de teste: `SEED_ACCOUNTS` em `lib/server/seed-data.ts`.
- Ligado por padrão em desenvolvimento. Em produção só com `NEXT_PUBLIC_DEVTOOLS=true` e `DEV_TOOLS=true`.

## Estrutura
```
app/
  (site)/          landing, catálogo e checkout
  conta/           área do cliente (login público, resto protegido)
  admin/           backoffice
  api/             rotas HTTP (auth, me, admin, dev)
components/        ui/ (componentes base), landing/, admin/, conta/, dev/ (DevToolbar)
lib/
  types.ts         tipos de domínio
  contracts.ts     formatos da API e validações compartilhadas
  services/        ÚNICO acesso a dados da UI (chama app/api)
  server/          só servidor: banco (db/), regras de negócio (domain/), sessão e HTTP
  dev/             configurações da DevToolbar
middleware.ts      redireciona /admin e /conta para o login sem cookie de sessão
```

A UI nunca importa de `lib/server` — só de `lib/services`. As permissões são verificadas no
servidor a cada chamada.

## Deploy na Vercel
- Faça push para GitHub (repo novo)
- Em vercel.com → Add New Project → Import Git Repository
- Vercel detecta Next.js automaticamente → Deploy
