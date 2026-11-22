# Modelo de permissões

A tabela descreve o escopo de produto previsto para cada papel. As migrações são a referência para o que o banco libera em cada entrega.

| Papel | Escopo |
| --- | --- |
| Owner | Administração da organização, membros e operação. Gestão comercial quando disponível. |
| Admin | Administração da operação, serviços, agenda e configurações autorizadas. |
| Manager | Gestão de agenda e relatórios operacionais autorizados. |
| Reception | Agenda, contatos e cadastros administrativos. |
| Professional | Agenda própria e pacientes autorizados. Atividades e registros conforme vínculo e módulo. |
| Guardian | Pacientes com vínculo autorizado, com agenda e atividades compartilhadas. |
| Patient | Perfil próprio e recursos explicitamente disponibilizados. |

A autorização efetiva resulta da combinação de sessão, organização, vínculo ativo, papel e contexto do registro. Ocultar uma ação na interface é uma decisão de UX. A tentativa direta é decidida pela camada de servidor e pelo banco.
