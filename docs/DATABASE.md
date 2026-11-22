# Banco de dados

As migrações versionadas em `supabase/migrations` definem o schema executável. O desenho agrupa dados por ciclo de produto.

| Domínio | Relações | Regras |
| --- | --- | --- |
| Identidade | Auth, profiles, organizations, organization_memberships | A identidade de Auth corresponde a um perfil. O vínculo associa identidade, clínica, papel e estado. |
| Operação | patients, professionals, specialties, services, appointments | Relações tenant-scoped preservam integridade. Agendamentos usam instantes e bloqueiam sobreposição conforme os estados ativos. |
| Portal | guardians, patient_guardians, activities, patient_activities | Dados do paciente dependem da própria identidade ou de vínculo explícito. |
| Experiência | rewards_catalog, reward_ledger, patient_inventory | Créditos e aquisição de itens exigem atualização atômica. |
| Governança | organization_invites, notifications, announcements, consent_records, audit_logs | Convites armazenam hash e expiração. Notificações e auditoria respeitam o escopo de acesso. |
| Comercial | plans, subscriptions | Definições e limites de planos se concentram em configuração central. |

As migrações iniciais cobrem identidade, operação, convites, responsáveis, auditoria, planos, atividades, avisos e o núcleo do Pixel World. Notificações individuais e registros de consentimento seguem o [quadro de trabalho](PROJECT_STATUS.md). Registros clínicos exigem revisão própria antes da migração.

O campo `plans.limits.active_professionals` aceita um inteiro não negativo. O banco exige esse teto no cadastro e na reativação de profissionais, com serialização por assinatura vigente. Os planos iniciais têm o limite em aberto, até a configuração comercial.
