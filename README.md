# Chá de Fraldas da Laura

Next.js + Supabase. Reserva de pacotes em vários tamanhos, edição e cancelamento seguro. Visual inspirado no convite em creme, rosé e marrom, com tipografia manuscrita e detalhes delicados. A fonte é hospedada junto com o app, sem consulta a fontes externas.

## Metas

| Tamanho | Pacotes |
| --- | ---: |
| RN | 2 |
| P | 5 |
| M | 7 |
| G | 6 |
| XG | 0 (oculto quando não há reserva existente) |
| Total | 20 |

## Atualizar a aplicação já publicada

1. No SQL Editor do Supabase existente, execute `supabase/migrations/20261102_laura_targets.sql`.
   - Não apaga nomes, reservas ou itens existentes.
   - Bloqueia o estoque na mesma ordem das funções de reserva.
   - Aborta integralmente se houver reservas acima de alguma nova meta (inclusive XG).
   - Pode ser repetido com segurança.
2. No GitHub `raphaelrt101/cha-fraldas-laura`, envie o conteúdo deste projeto preservando as pastas. Substitua os arquivos antigos quando solicitado. `package.json` deve continuar na raiz.
3. Acompanhe o novo deploy na Vercel. Mantenha as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já configuradas.
4. Quando estiver Ready, confirme o visual novo e consulte `/api/stock`. Os totais devem ser RN=2, P=5, M=7, G=6, XG=0. Reservas válidas existentes continuam descontadas desses totais.

Não basta executar novamente o schema para mudar o estoque existente: o seed do schema usa `on conflict do nothing`. Use a migração acima.

## Como o convidado usa

- Informa o nome e escolhe um ou mais tamanhos/quantidades.
- Confirma o presente. A reserva fica no banco, não só no celular.
- O navegador guarda o código de acesso da última reserva. Ao voltar pelo endereço principal no mesmo navegador, ela é aberta automaticamente.
- Para outro aparelho ou navegador, pode copiar e guardar o link privado.
- Em aparelho compartilhado, a opção “Esta reserva não é sua? Fazer outra reserva” permite iniciar outra sem cancelar a anterior. Guarde o link anterior antes de trocar.
- O link não é necessário para o retorno habitual no mesmo navegador, mas é o único meio de recuperar em outro navegador sem login. Navegação anônima, bloqueio/limpeza de armazenamento ou troca de navegador podem impedir o retorno automático. Nesse caso, use o link guardado.
- Quem possui o link pode gerenciar a reserva: não compartilhe em grupos.

## Instalação nova / desenvolvimento

Node.js 22+. Execute `npm ci`.

Para um banco novo, execute `supabase/schema.sql` no Supabase. Copie `.env.example` para `.env.local` e preencha as variáveis com os dados do projeto. A URL deve ser `https://<project-ref>.supabase.co`, não a URL do painel. A chave de servidor pode ser a secret key atual ou a service_role legada. Nunca use o prefixo NEXT_PUBLIC para essa chave e nunca envie `.env.local` ao GitHub.

Execute `npm run dev` para desenvolver ou `npm run build` e `npm start` para produção.

## Testes

- `npm test`: funções SQL, validações, metas, permissões, rollback e migração segura num PostgreSQL embarcado (PGlite).
- `npm run test:api`: inicia sozinho um banco de teste e verifica as rotas reais Next.js, incluindo chamadas simultâneas, token inválido, indisponibilidade e cancelamento repetido. Não usa credenciais reais e não toca em produção.
- `npm run build`: compilação e TypeScript, sem necessidade de credenciais de produção.

Veja `VALIDACAO.md` para o resultado e os limites da revisão.

## Estrutura e proteção

- A chave de servidor só é lida em `lib/db.ts`, usado pelas rotas servidoras.
- Tokens de 32 bytes aleatórios; apenas seu SHA-256 é salvo no banco. O token de acesso fica no fragmento do link e, se permitido, no armazenamento local do navegador.
- Operações de estoque são transacionais e bloqueiam as linhas numa ordem consistente. Falhas não deixam itens parcialmente alterados.
- Leitura direta das tabelas e execução das funções são proibidas aos papéis anon/authenticated.
- Nome renderizado como texto pelo React; nenhuma renderização de HTML fornecido por participantes.
- Atualização automática de disponibilidade a cada 10 segundos. O estoque é conferido de novo ao confirmar.
- Testes/fixtures em `tests/` não são rotas de produção. Não envie o ambiente temporário usado para QA.
- Não há login nem painel administrativo. O app não inclui proteção contra reservas fictícias em massa (CAPTCHA/rate limiting distribuído). Foi pensado para o pequeno grupo do evento.
