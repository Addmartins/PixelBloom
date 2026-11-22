# Testes de autorização

Aplique as migrações em um banco Supabase local e execute os comandos abaixo com um URL local que tenha acesso administrativo de teste.

```bash
for test_file in tests/security/*.sql; do
  psql "$PIXELBLOOM_LOCAL_DATABASE_URL" -f "$test_file" || exit 1
done
```

Os scripts criam identidades sintéticas em transações e verificam as operações no papel autenticado. Cobrem leitura própria, isolamento entre organizações, revogação, permissões de papel, planos, visibilidade profissional, duração, sobreposição e transições da agenda, aceitação e expiração de convites, escopo de responsáveis, opt-in e resgate de recompensas, além de isolamento de arquivos e formatos aceitos. As fixtures são revertidas ao fim.

O teste de Storage insere somente metadados e libera o comando SQL de exclusão na própria transação para verificar a política RLS. A aplicação usa a API de Storage para remover arquivos.
