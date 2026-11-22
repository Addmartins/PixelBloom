# Segurança e privacidade

| Ameaça | Controle | Verificação |
| --- | --- | --- |
| Acesso por identificador de outra clínica | RLS por papel e organização, chaves compostas | Consultar e gravar com identidades sintéticas de clínicas distintas |
| Elevação de privilégios | Papel no vínculo persistido, criação de owner por RPC controlada | Verificar que usuário comum não altera o papel |
| Vínculo revogado com sessão válida | Decisão baseada no vínculo atual | Revogar vínculo e repetir uma consulta |
| Vazamento de credenciais | Chaves privadas fora do navegador e do versionamento | Revisar variáveis, logs e build |
| Entrada não confiável | Schemas Zod, operações parametrizadas, renderização segura e constraints | Validar campos e revisar uso de HTML e SQL |
| Vazamento em arquivos ou cache | Buckets privados e cache restrito a recursos públicos | Verificar políticas de objetos e armazenamento do PWA |
| Conflitos de agenda concorrentes | Constraint de sobreposição em PostgreSQL | Tentar registrar janelas conflitantes na mesma agenda |

## Governança antes do uso com dados reais

Validar com o controlador os papéis de tratamento, as bases legais aplicáveis, as informações a titulares, o fluxo de responsáveis legais, o atendimento a direitos e os prazos de retenção. Dados de saúde e de menores exigem avaliação específica. Guardar registros suficientes para auditoria e eliminar conteúdo sensível dos logs. Desenvolver e testar exclusivamente com dados sintéticos.
