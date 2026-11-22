# PRD do PixelBloom

PixelBloom é um SaaS para organizar a operação e a experiência digital de clínicas multidisciplinares. Cada clínica pode configurar serviços, equipe, horários e módulos de acordo com a própria operação.

## Primeira entrega

| Pessoa | História | Critério de aceite |
| --- | --- | --- |
| Proprietário | Quero acessar minha conta e iniciar uma clínica | Cadastro, confirmação quando configurada, login e logout funcionam com o Supabase Auth. O onboarding cria organização e vínculo owner de forma atômica. |
| Usuário com múltiplos vínculos | Quero alternar entre organizações autorizadas | A seleção de clínica é validada no servidor. Dados e ações seguem o papel da clínica selecionada. |
| Recepção | Quero cadastrar pacientes e agendar atendimentos | Formulários persistem apenas pacientes e atendimentos no tenant permitido. Um profissional não recebe horários ocupados. |
| Administração | Quero cadastrar equipe e serviços | A operação usa registros reais. Campos inválidos e referências de outros tenants são rejeitados no servidor. |
| Profissional | Quero ver minha agenda e os pacientes autorizados | O banco limita a visibilidade ao papel e ao vínculo aplicável. |
| Responsável | Quero consultar apenas pacientes sob minha autorização | Acesso depende do vínculo explícito e do estado de autorização. Esta jornada entra após o núcleo operacional. |
| Paciente | Quero participar de atividades e personalizar meu avatar se desejar | A experiência é opcional e individual. O portal não exibe rankings e não usa recompensas como avaliação clínica. |

Cadastro → confirmação quando configurada → criação de clínica → dashboard → configuração gradual de equipe, serviços e agenda. O proprietário pode retomar o cadastro operacional após acessar o dashboard.

## Regras e decisões de produto

- A agenda exibe horários no fuso configurado pela organização, com America/Recife como padrão. Os agendamentos são persistidos com fuso.
- Uma mesma conta pode ter vários vínculos. Cada papel é atribuído por organização.
- Dados de desenvolvimento são sintéticos.
- Regras de feriados, fila de espera, cancelamento pelo portal, capacidade, consentimento e operação clínica variam por organização. Critérios são confirmados antes de automatizar essas rotinas.
- Trial, cobrança, limites mensuráveis, módulos e preços exigem decisão comercial. A arquitetura admite evolução sem pagamento na fase inicial.
- Registros clínicos completos ficam fora da primeira entrega.
