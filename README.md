# Professor Play

Plataforma de atividades escolares e jogos ao vivo. React, TanStack Start, Tailwind e Supabase.

Esta versão usa build independente e IA configurável, desligada por padrão.
Leia [MIGRACAO.md](MIGRACAO.md) para configuração local, publicação, banco e testes reais pendentes.

## Desenvolvimento

Node.js 24 e npm. Copie `.env.example` para `.env`, preencha as variáveis Supabase e execute:

```sh
npm ci
npm run dev
```

## Verificação e produção

```sh
npm run typecheck
npm run build
npm start
```

Para Vercel, importe o repositório e cadastre as variáveis conforme MIGRACAO.md.
Não envie `.env`, chaves de IA ou credenciais administrativas ao GitHub.
