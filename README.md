# Chá de Bebê — reserva de fraldas

Aplicação Next.js + Supabase para reserva de pacotes, edição e cancelamento por link privado.

## Preparação
1. Instale Node.js 20+ e rode `npm install`.
2. Crie um projeto em https://supabase.com/dashboard.
3. No SQL Editor do Supabase, execute `supabase/schema.sql`.
4. Copie `.env.example` para `.env.local` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API Keys). Nunca use `NEXT_PUBLIC_` nessa chave.
5. Rode `npm run dev` e acesse http://localhost:3000.
6. Para ajustar metas, execute no SQL Editor: `update public.diaper_stock set total=30 where size='M';` (não reduza abaixo das reservas existentes).

## Publicar na Vercel
1. Crie um repositório privado no GitHub e envie os arquivos (sem `.env.local`).
2. Em https://vercel.com/new, importe o repositório pessoal e selecione Next.js.
3. Em Environment Variables, adicione `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` como variáveis de servidor.
4. Clique em Deploy. Compartilhe o domínio `.vercel.app` gerado.
5. Teste reserva, alteração e cancelamento com dois navegadores distintos.

## Segurança e limites
- Nunca exponha a service role key ao navegador ou ao Git.
- Todas as operações passam por rotas servidoras; funções SQL com lock serializam alterações no estoque.
- Links de reserva são credenciais: não compartilhe publicamente nem publique capturas com o token.
- Não há login; usuários anônimos podem criar reservas fictícias. Para evento público ou risco de abuso, acrescente rate limiting e CAPTCHA.
- Disponibilidade atualiza por polling a cada 10 segundos, não WebSocket.
- O plano gratuito tem limites e pode sofrer pausas por inatividade; consulte condições atuais.

## Validação desta revisão
- `npm ci` instala as versões fixadas em `package-lock.json`.
- `npm run build` verifica TypeScript e gera o build de produção.
- `npm test` executa as funções SQL num PostgreSQL embarcado (PGlite), verificando estoque, múltiplos tamanhos, rollback, validação, cancelamento repetido e restrições de acesso.
- O teste embarcado omite apenas a extensão pgcrypto (gen_random_uuid já é nativo). Os papéis do Supabase são simulados. Concorrência entre conexões deve ser validada no Supabase antes da publicação.
- Links novos usam `/#reserva=...`; o código fica no fragmento do navegador. Links antigos com query continuam aceitos.

Metas iniciais do projeto original: RN 5, P 10, M 20, G 15, XG 10 pacotes.
