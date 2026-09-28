# Validação — 28/09/2026

Base: ZIP do commit a2e90f4df8651794c9fca2ace51e8e3319f53c94.

- Instalação npm concluída; package-lock.json gerado sem pacotes @lovable.dev.
- TypeScript: aprovado, zero erros.
- Build Node/Nitro: aprovado.
- Build com NITRO_PRESET=vercel: aprovado; gerou .vercel/output.
- Servidor de produção em processo isolado: /, /login, /cadastro, /jogar e /app retornaram HTTP 200 com HTML do produto; rota inexistente retornou 404.
- Testes de configuração de IA: modo desativado, ausência de credenciais e endpoint HTTP bloqueados, sem chamadas ao provedor.
- Google não é mostrado na página de login quando não habilitado.
- ESLint: zero erros; dez avisos existentes de Fast Refresh (componentes e helpers exportados no mesmo arquivo). Erros de formatação existentes corrigidos.
- Nenhuma ocorrência Lovable no código executável src/, no package.json, no lockfile ou no vite.config.ts após a migração.

Não foram realizados: testes de navegador com interação/hidratação, login real, confirmação de e-mail, OAuth, partidas entre dispositivos, migrações contra banco, validação RLS em execução, geração com IA paga ou publicação real na Vercel. HTTP 200 em /app verifica renderização inicial, não autenticação funcional.

Avisos de dependências preservadas: Recharts 2, ESLint 9 e tsconfck têm avisos de manutenção/descontinuação. O build também alerta sobre bundle grande e inputValidator deprecado; não impedem a compilação. Atualizações maiores devem ser feitas separadamente com testes do produto.

Reprodução: npm ci; npm run typecheck; npm run build; npm run test:smoke; npm run lint.
O smoke test usa Node 24 e o build Node padrão, com Google desativado.
