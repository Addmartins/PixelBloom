# PixelBloom

SaaS multi-tenant para a operação de clínicas multidisciplinares. A primeira etapa cobre autenticação, criação e seleção de organizações, cadastros operacionais e agenda. O PostgreSQL valida vínculo e papel em cada clínica.

## Stack

Next.js e React com App Router, TypeScript estrito, Tailwind CSS, Lucide, Zod, React Hook Form, Supabase Auth e PostgreSQL com RLS. A interface inclui manifesto PWA e mantém páginas autenticadas fora do cache do service worker.

## Desenvolvimento local

1. Instale Node.js 22 ou superior, Docker e a CLI do Supabase.
2. Execute `npm ci` e `supabase start`. Use `supabase migration up --local` para aplicar migrations pendentes.
3. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave **publicável** ou `anon` do ambiente. Mantenha `APP_URL=http://localhost:3000` para desenvolvimento local.
4. Execute `npm run dev` e acesse `http://localhost:3000`.
5. Cadastre um usuário sintético, crie a clínica e siga para os cadastros operacionais. Se a confirmação estiver habilitada, abra o e-mail no Mailpit local.

## Área da família e PixelBloom Kids

- No portal do responsável, abra **Área da família** para consultar agendamentos, configurar o Kids, ver o histórico autorizado e resgatar prêmios para uma criança vinculada.
- A conta do paciente abre o **PixelBloom Kids** em `/kids`. O navegador compatível pode instalá-lo pela página do Kids, que tem manifesto web próprio. A experiência depende de conexão.
- A clínica ativa o Pixel World em um plano que inclui o recurso, vincula as contas do paciente e do responsável e cadastra os prêmios. O paciente adere pela tela do Kids. Os jogos concedem cinco pontos por conclusão, uma vez por jogo por dia. A clínica registra a entrega dos prêmios físicos.
- Registros emocionais são voluntários e começam desativados. O responsável pode autorizar os registros, pausar o Kids ou revogar a autorização. Revogar a autorização apaga o histórico.

## Apps Android de teste

Com JDK, Android SDK Platform 34, Build Tools 36.0.0 e um keystore de depuração do Android, execute `node scripts/build-android.mjs https://seu-ambiente-de-teste`. O script gera os APKs assinados de Família e Kids em `public/downloads`. Cada app tem sua própria instalação e abre o portal correspondente em um WebView.

Para testes com dados sintéticos na mesma rede Wi-Fi, o script também aceita uma origem HTTP com IPv4 privado. Use a origem do servidor Next.js que o celular consegue alcançar e mantenha o servidor ligado. Para distribuição externa, use uma origem HTTPS.

## Supabase e ambientes

Defina `APP_URL` como a origem pública canônica do ambiente. Configure essa mesma origem como Site URL no Supabase Auth e permita os callbacks `/auth/callback?flow=signup` e `/auth/callback?flow=recovery`. Com os templates PKCE padrão, abra o link na mesma sessão de navegador que iniciou a solicitação. Use Mailpit em desenvolvimento e habilite envio externo somente após configuração e autorização.

Use projetos Supabase separados para staging e produção, com credenciais independentes. A chave privilegiada fica fora do aplicativo. Para staging, aplique as migrações ao projeto explicitamente selecionado e valide Auth, RLS e as jornadas antes de promover o build.

## Verificação

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os scripts SQL de autorização ficam em `tests/security`. Execute-os com `psql` em um banco descartável que já recebeu as migrations. Consulte o status para saber quais fluxos foram verificados.

## Planejamento e operação

- [Status e critérios de aceite](docs/PROJECT_STATUS.md)
- [Requisitos e roadmap](docs/PRD.md) · [Roadmap](docs/ROADMAP.md)
- [Arquitetura e banco](docs/ARCHITECTURE.md) · [Banco](docs/DATABASE.md)
- [Tenancy e segurança](docs/TENANCY.md) · [Segurança](docs/SECURITY.md)
- [Preparação de staging, produção e operação](docs/OPERATIONS.md)
# PixelBloom
