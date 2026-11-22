# Operação e release

## Staging

Use um projeto Supabase exclusivo, com dados sintéticos. Configure `APP_URL`, a URL e a chave publicável no runtime Next.js. Em Supabase Auth, configure a Site URL e permita os callbacks de cadastro e recuperação para a origem de staging. Use uma caixa de teste autorizada para a confirmação de e-mail e a recuperação.

Antes de aplicar migrations, confirme o ID do projeto de staging e revise as alterações SQL em comparação com o banco local. Aplique pela CLI em ambiente autorizado. Publique o build Next.js em um runtime Node.js com HTTPS e valide cadastro, recuperação, agenda e acesso com usuários de duas organizações de teste. Acompanhe separadamente sucesso do deploy e versão das migrations aplicadas.

## Produção

Use um projeto Supabase separado e um runtime Next.js com HTTPS. A promoção exige aprovação do ambiente, do provedor de e-mail e das políticas operacionais. Restrinja as chaves administrativas à infraestrutura autorizada. O runtime da aplicação usa exclusivamente a chave publicável e a sessão do usuário.

Para alterações de schema, confirme a compatibilidade entre aplicação e banco durante a troca de versão. Em caso de regressão, restaure a versão anterior compatível do aplicativo e use uma migration corretiva para mudanças de banco. Exercite restauração em um ambiente isolado antes de aprovar o procedimento em produção.

## Logs, backup e resposta

Monitore latência, erros agregados, disponibilidade da aplicação e do Supabase, falhas de entrega e resultados dos testes CI. Use IDs técnicos de correlação. Exclua conteúdo dos formulários, tokens, cabeçalhos de autenticação, links de e-mail e dados de pacientes dos logs e alertas.

Confirme a cobertura de backup do plano contratado para PostgreSQL e objetos do Storage. Registre RPO e RTO, o responsável de plantão e o canal de comunicação de incidentes. Teste a restauração de dados e arquivos de forma independente. Esses valores e o provedor de monitoramento dependem de decisão operacional.
