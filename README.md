# Cidade Limpa — site + servidor (Node.js + PostgreSQL)

Estrutura:
- `public/index.html` — estrutura (HTML) do site, página única
- `public/css/style.css` — visual (CSS)
- `public/js/script.js` — comportamento (JavaScript): formulário, login, tabela e filtros
- `public/img/` — imagens do site
- `server.js` — servidor: login do agente fiscal + API do formulário
- `schema.sql` — tabelas do PostgreSQL (`agentes` e `submissoes`)
- `init-db.js` — cria as tabelas (`npm run init-db`)
- `criar-agente.js` — cadastra agente (`npm run criar-agente -- 12345 "Nome" "senha"`)
- `.env.example` — modelo das variáveis de ambiente

## Rodar no seu computador
1. Instale o Node.js 18+ (https://nodejs.org) e tenha um PostgreSQL (local ou Neon/Supabase).
2. `npm install`
3. Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `JWT_SECRET`.
4. `npm run init-db`
5. `npm run criar-agente -- 12345 "Agente Teste" "uma-senha-forte"`
6. `npm start` e abra http://localhost:3000

## Publicar (resumo)
Suba esta pasta para um repositório no GitHub (sem o `.env`), crie um "Web Service"
no Render/Railway com `npm install` / `npm start` e configure as variáveis
`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production` (e `DATABASE_SSL=true` se necessário).
