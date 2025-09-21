
# Festinhas Criativa Papelaria — Site (Vite + React + Tailwind)

## Rodar local
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy na Vercel (via GitHub)
1. Crie o repositório no GitHub (ex: festinhas-site)
2. No terminal dentro da pasta:
```bash
git init
git add .
git commit -m "feat: initial site"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/festinhas-site.git
git push -u origin main
```
3. Em vercel.com → Add New Project → Import Git Repository → selecione seu repo
4. Build: `npm run build` | Output: `dist`
5. Deploy 🚀
