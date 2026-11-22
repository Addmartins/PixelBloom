# Arquitetura

O Next.js App Router hospeda a interface e as ações de servidor. TypeScript estrito e validação Zod cobrem entradas de formulários. O Supabase Auth gerencia identidade e sessão. PostgreSQL e RLS validam isolamento e autorização, inclusive quando o cliente contorna a interface.

## Fluxo de operação

1. A aplicação lê a sessão autenticada.
2. A rota exige um vínculo ativo com a organização selecionada.
3. A ação valida a entrada e envia a operação ao Supabase no contexto da sessão.
4. RLS decide o acesso. Constraints do PostgreSQL preservam a integridade relacional.
5. A ação retorna estado de sucesso ou um erro tratado sem expor diagnósticos internos.

As migrações em `supabase/migrations` versionam o schema. Features do aplicativo concentram regras de interface por domínio. Componentes reaproveitáveis concentram padrões visuais. Testes unitários cobrem transformações e validações. Testes de navegador cobrem navegação e formulários. Testes SQL cobrem as fronteiras de autorização.

## Evolução

Storage privado usa chaves de objeto com o identificador da organização e policies por acesso. Planos e assinaturas residem no domínio comercial. Processamento de pagamento será integrado após definição de provedor. O PWA pode armazenar recursos públicos para melhorar a inicialização, preservando a confidencialidade das respostas autenticadas.
