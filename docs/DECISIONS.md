# Decisões técnicas

| ID | Decisão | Consequência |
| --- | --- | --- |
| ADR-001 | Next.js App Router com TypeScript e Supabase | Sessões e ações passam pelo servidor, com autorização também no PostgreSQL. |
| ADR-002 | Clínica é uma organização, com papéis por vínculo | A conta pode operar em várias organizações e manter permissões diferentes em cada uma. |
| ADR-003 | Chaves compostas nas referências tenant-scoped | Um registro de outra clínica não pode ser usado em uma relação por engano. |
| ADR-004 | Primeira entrega centrada na agenda e cadastros operacionais | Portais, cobrança e gamificação evoluem após o núcleo com regras próprias. |
| ADR-005 | Dados autenticados fora do cache persistente do PWA | A aplicação preserva a confidencialidade das páginas privadas no dispositivo. |

## Toolchain do build

O build usa Webpack e a API do compilador TypeScript 5.9 no Next.js 16. Neste ambiente, o processamento CSS do Turbopack exige um socket indisponível para o build, e a execução do compilador via CLI foi interrompida na leitura da configuração. O build continua verificando tipos estritos.
