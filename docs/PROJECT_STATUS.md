# Quadro de trabalho

Inspeção inicial em 22/11/2026. O diretório começava sem código de produto. A sessão principal coordena a integração e revisa as alterações de arquitetura.

| ID | Nome e descrição | Responsável | Dependências | Critério de aceite | Status |
| --- | --- | --- | --- | --- | --- |
| PB-01 | Planejamento e desenho da primeira entrega | Produto e Tech Lead | — | PRD, arquitetura, segurança e quadro registrados | REVIEW |
| PB-02 | Fundação de build e identidade | Tech Lead e DevOps | PB-01 | Instalação, build, cadastro e sessão com Supabase | REVIEW |
| PB-03 | Organizações, vínculos e RLS | Banco e Tenancy | PB-01 | Criação atômica e escopos por papel e organização | REVIEW |
| PB-04 | Onboarding e dashboard | UX e Frontend | PB-02, PB-03 | Acessar a operação em contexto autorizado após cadastro progressivo | REVIEW |
| PB-05 | Pacientes, profissionais, serviços e agenda | Frontend e Banco | PB-03 | Persistência real, validação e prevenção de conflitos | REVIEW |
| PB-06 | Responsáveis, acesso ao portal e convites | Produto, Banco e Frontend | PB-03, PB-05 | Vínculos autorizados e convites com expiração | REVIEW |
| PB-07 | Atividades, Pixel World e recompensas | Experiência e Frontend | PB-06 | Opt-in e estado individual persistente | REVIEW |
| PB-08 | Planos, limites e assinatura | Tenancy e Tech Lead | PB-03 | Planos configuráveis e autorização de recursos centralizada | REVIEW |
| PB-09 | Testes de navegador, banco e regras | QA e AppSec | PB-02, PB-03, PB-05 | Evidência de autenticação, permissões e isolamento | REVIEW |
| PB-10 | Staging e operação | DevOps | PB-09 | Aplicar migrações e verificar fluxos em projeto Supabase autorizado | BLOCKED |

A validação local usou Supabase e dados sintéticos. A validação em staging depende de um projeto autorizado e de sua configuração.

## Evidência de testes local

- Lint, verificação de tipos, build de produção e 19 testes do Vitest passaram. Os testes unitários cobrem autenticação, origem de redirecionamento, logo da clínica e datas da agenda.
- Os onze scripts de autorização passaram no PostgreSQL do Supabase local. Cobrem isolamento por organização, agenda, disponibilidade, atividades, responsáveis, convites, planos, recompensas, especialidades, Storage e permissões da Área da família e do Kids.
- Playwright registrou cinco cenários aprovados e três ignorados. Os testes de acesso anônimo e formulários públicos passaram em desktop e mobile. A jornada desktop com Supabase local e Mailpit passou por cadastro, confirmação por e-mail, criação de clínica, serviço, profissional e paciente, agendamento, cancelamento, logout, recuperação da senha e novo login. A jornada completa está configurada para desktop. Os dois testes de sessão isolada exigem uma conta sintética pré-configurada.
- A jornada Família e Kids passou no Chrome contra o build de produção local com duas contas sintéticas. O teste cobriu autorização do registro emocional, visualização pelo responsável, pontuação em jogo, resgate e uso de acessório de avatar e resgate físico personalizado.
