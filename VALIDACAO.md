# Validação da revisão — 02/11/2026

## Resultado

Revisão local aprovada nas verificações abaixo. A publicação desta revisão ainda depende do envio dos arquivos ao GitHub e da aplicação da migração SQL no Supabase. O acesso de escrita via integração GitHub retornou HTTP 403 e não houve acesso de administração ao banco nem à Vercel nesta revisão.

## Verificações executadas

- Build de produção e TypeScript.
- Testes SQL com as metas RN=2, P=5, M=7, G=6, XG=0.
- Múltiplos tamanhos, alteração com devolução de itens, estoque esgotado, tentativa acima do estoque e rollback integral de alterações inválidas.
- Quantidade nula, vazia, negativa, zero, fracionária, string, acima do limite, tamanho desconhecido e tamanho duplicado.
- Cancelamento, token desconhecido, acesso após cancelamento e cancelamento repetido sem devolver pacotes duas vezes.
- Permissões dos papéis anon e authenticated sobre tabelas, view e funções privilegiadas.
- Migração repetível, preservação de reservas e bloqueio de redução abaixo das reservas existentes.
- 36 verificações de API usando os handlers reais Next.js e um Supabase simulado sobre PostgreSQL embarcado. Incluem JSON malformado, nome com acentos e espaços, nomes fora do limite, token aleatório de 64 caracteres, cabeçalho no-store, requisições simultâneas pelo último estoque, cancelamentos simultâneos e falhas no banco.
- Navegador Chrome: criação, múltiplos tamanhos, limite de quantidade, alteração, recarga com persistência, cópia do link, recuperação pelo link, manter reserva antes do cancelamento, cancelamento confirmado e link cancelado.
- Retorno automático no mesmo navegador sem colar o link, e remoção desse retorno automático após cancelamento.
- Layout em largura 320, 390 e 768 pixels, sem transbordamento horizontal. Fluxo de criação e cancelamento também exercitado na visualização de 390 pixels.
- Mensagem de indisponibilidade, bloqueio da confirmação durante falha e restauração do estoque após o serviço voltar.
- Todos os dados de QA foram criados em um banco separado de produção.

## Limites

- Não é uma garantia de ausência de qualquer erro. Não se executaram testes em aparelhos físicos, Safari/iOS, todos os navegadores, leitores de tela, carga prolongada ou ataque de abuso.
- O PGlite atende as chamadas em uma única instância; os testes simultâneos de API verificam o comportamento das rotas sobre esse banco. Concorrência entre conexões reais do Supabase deve ser reconfirmada após a publicação. As funções de bloqueio de estoque foram preservadas desta revisão em relação à versão anterior que já havia sido testada no Supabase real.
- Os números do estoque em produção só mudam após a aplicação da migração; o seed do schema não sobrescreve o banco existente.
- A lembrança da reserva depende de armazenamento local disponível e do mesmo navegador/origem. O link privado continua sendo a alternativa para outro navegador ou aparelho.
