# Design System

A interface operacional combina roxo profundo, verde-água e superfícies neutras. Pixel art original fica concentrada na marca e nas experiências interativas. A interface de tarefas administrativas mantém hierarquia de texto e controles convencionais.

| Token conceitual | Finalidade |
| --- | --- |
| Primary e on-primary | Ação principal e seu texto |
| Accent e accent-surface | Destaques, informação positiva e experiência interativa |
| Surface e text | Fundo operacional, leitura e cartões |
| Muted e border | Texto auxiliar e divisões de interface |
| Danger e focus | Erros e navegação por teclado |
| Espaçamento | Escala de 4, 8, 12, 16, 24 e 32 px |
| Formas | Controles com cantos suaves e cartões com raio maior |
| Motion | Transições curtas que respeitam preferência por movimento reduzido |

Cada grupo de página mantém título, conteúdo e ações numa ordem semântica. Estados de erro e carregamento são legíveis por tecnologia assistiva. Campos usam labels. Em telas estreitas, formulários usam uma coluna, controles mantêm alvos confortáveis e tabelas preservam o acesso às ações. A paleta e os espaçamentos implementados ficam nas folhas de estilo do projeto.

## Navegação da clínica

A barra lateral mostra o nome e o papel do usuário na clínica ativa. O seletor de organizações permite trocar para outro vínculo e reúne as ações de criar uma clínica e aceitar um convite. A navegação indica a página ativa com `aria-current`. Em telas estreitas, a navegação fica acima do conteúdo e os formulários são empilhados.

## Agenda e formulários

A agenda usa o fuso da clínica para selecionar o dia, exibir horários e interpretar a data informada nos formulários. As setas do seletor têm rótulos para leitores de tela. Confirmação, reagendamento e cancelamento aparecem junto do atendimento quando o papel e o estado do agendamento permitem cada ação. Erros de gravação preservam os dados dos campos e são anunciados com `role="alert"`. A confirmação de sucesso usa `role="status"`.

## Identidade da organização

O seletor mostra a inicial do nome até o envio do logotipo. A prévia em Configurações identifica a imagem atual e informa os formatos e o limite de 2 MiB junto do campo de envio. A exibição usa uma rota autenticada da própria aplicação.
