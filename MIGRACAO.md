# Professor Play — migração independente

## O que esta entrega faz

Remove os pacotes de build e autenticação da Lovable, o armazenamento de sessão do preview, a telemetria do editor e o gateway de IA da Lovable. Preserva páginas, imagens, editor, regras SQL e motor de partidas. Adiciona criação manual de perguntas, Google opcional via Supabase, confirmação de e-mail no cadastro e configuração Vercel/TanStack Start.

O ZIP original continua sendo o backup. Esta entrega não altera seu GitHub, o banco de dados, o domínio ou a aplicação publicada.

## Rodar no computador

Use Node.js 24 e npm. Extraia o ZIP e abra um terminal na pasta que contém package.json.

```powershell
Copy-Item .env.example .env
npm ci
```

Preencha `.env` com URL e chave **publishable** do seu projeto Supabase, repetindo os valores nos campos com e sem `VITE_`. Nunca use `service_role` nos campos públicos. Então:

```powershell
npm run dev
```

Abra o endereço exibido no terminal. Para verificar tipos e gerar a versão de produção:

```powershell
npm run typecheck
npm run build
npm start
```

## Banco: código exportado não é backup dos dados

O ZIP contém seis migrações SQL, mas não contém usuários, senhas, atividades existentes nem acesso administrativo ao Supabase. Confirme se o projeto aparece em sua própria conta Supabase ou é gerenciado pelo Lovable Cloud. URL e chave publishable não dão acesso para administrar/exportar o banco.

Se continuar usando o mesmo banco, não reaplique as migrações existentes. Se precisar migrar para outro projeto, faça primeiro backup de dados e autenticação e planeje a transferência. Não apague a aplicação antiga antes de validar os dados e o acesso no destino. Nenhuma migração SQL foi aplicada por esta entrega.

## Publicar na Vercel

1. Suba esta versão em uma branch separada do seu repositório, revisando as diferenças. Copiar os arquivos por cima não apaga os arquivos removidos; veja REMOVIDOS.txt.
2. Importe o repositório na Vercel. A configuração usa `tanstack-start`, instalação `npm ci` e build `npm run build`. É uma aplicação com servidor, não apenas uma pasta estática.
3. Cadastre as quatro variáveis Supabase de `.env.example` tanto no ambiente Preview quanto no Production. Mantenha `AI_ENABLED=false` inicialmente.
4. No Supabase Auth, adicione a URL de Preview e, depois, a URL definitiva à lista de redirecionamentos permitidos; configure a Site URL definitiva.
5. Teste em Preview antes de promover a versão. Variáveis VITE são incorporadas no build: alterações exigem novo deploy.

Para Google, configure o provedor no Supabase e a URL de callback exibida por ele no console Google; então defina `VITE_GOOGLE_AUTH_ENABLED=true` e gere novo build. Sem isso, o botão não aparece; login por e-mail continua disponível.

## IA e custos

A IA está desligada por padrão. O professor pode criar perguntas manualmente e reutilizar atividades. Isso evita chamadas pagas de IA, mas não promete hospedagem/banco gratuitos.

Para habilitar, escolha um provedor/modelo que suporte Chat Completions compatível com OpenAI e saída estruturada JSON Schema. Configure apenas no servidor `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` e `AI_ENABLED=true`. O código não escolhe um plano pago nem cria credenciais. A integração com o provedor escolhido ainda precisa de teste real.

Cada chamada limita a saída a 6.000 tokens, não faz retries de transporte e tem timeout de 45 segundos. O gerador pode fazer uma segunda chamada para completar perguntas inválidas. O limite existente de 20 gerações por hora não é um teto financeiro: contagens concorrentes e chamadas malsucedidas ainda exigem um mecanismo atômico de reserva de uso antes de vender IA. Foi corrigido o comportamento que liberava a chamada quando a consulta de cota falhava. Configure também limites de gasto no provedor antes de habilitar.

## Verificação ponta a ponta antes de produção

- Cadastro com confirmação de e-mail, login, logout e retorno após atualizar a página.
- Criar manualmente, revisar, salvar e reabrir uma atividade.
- Entrar em sala pelo PIN/QR em outro navegador e testar reconexão.
- Iniciar partida, responder, avançar, encerrar e conferir ranking/resultados.
- Testar os quatro modos, incluindo distribuição de times.
- Testar isolamento entre duas contas de professor e acesso anônimo apenas às salas permitidas.
- Habilitar e testar IA somente após configurar provedor e controle de gastos.

## Arquivos e segurança

O pacote final não inclui `.env` nem `.env.local`. O arquivo do ZIP original tinha URL, ID e chave pública do Supabase; isso não comprova vazamento de segredo administrativo. As regras RLS continuam essenciais. Esta entrega não revisou o histórico Git e não remove nada que já tenha sido publicado no GitHub.

Não reescreva o histórico conectado à Lovable. Remover `.env` de uma nova versão não o remove do histórico; se um segredo real tiver sido publicado, ele deve ser revogado no provedor.

Referência de publicação: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
