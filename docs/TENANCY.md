# Isolamento entre organizações

`organizations.id` identifica o tenant, representado por `organization_id` nas tabelas de negócio. Uma sessão pode acessar várias clínicas conforme os vínculos ativos daquela identidade. A clínica selecionada é contexto de interface e a autorização é recalculada no servidor e no banco.

- Políticas de leitura, escrita e atualização verificam identidade, vínculo, organização e papel.
- Referências entre registros incluem a organização nas restrições de integridade. Um identificador válido de outro tenant não forma uma relação válida.
- Rotas e RPCs derivam a identidade da sessão. Operações de criação inicial são atômicas.
- Storage privado usa caminhos com escopo de organização. Políticas de objeto validam o acesso próprio de cada módulo.
- Arquivamento, suspensão e revogação devem encerrar a visibilidade operacional quando o vínculo fica inativo.

A validação inclui leitura e escrita entre duas organizações com identidades sintéticas distintas, além da revogação com sessão existente.
