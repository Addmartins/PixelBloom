# Testes em navegador

Instale Chromium com `npx playwright install chromium` e execute `npm run test:e2e`. A configuração inicia uma instância do Next.js em `http://localhost:3100` e executa a suíte em desktop e mobile.

Sem Supabase, a suíte verifica o encaminhamento para a página de configuração. Para executar os testes de autenticação, exporte no ambiente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` referentes ao Supabase de teste. O teste de sessão também usa `PIXELBLOOM_E2E_EMAIL` e `PIXELBLOOM_E2E_PASSWORD` de uma conta sintética confirmada, já vinculada a uma organização de teste.

Com Supabase local, `PIXELBLOOM_E2E_LOCAL=1 npm run test:e2e` roda também uma jornada desktop com cadastro, confirmação e recuperação via Mailpit na porta 54324, além de criação de clínica, serviço, profissional, paciente e atendimento. Nesse modo o Next.js usa a porta 3000 para os callbacks do Supabase. Exporte as variáveis públicas do projeto local antes de executar. O teste gera identificadores sintéticos exclusivos e mantém os registros para inspeção no ambiente local.
