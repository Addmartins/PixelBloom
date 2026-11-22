export default function Configuracao() {
  return (
    <main className="mx-auto max-w-lg p-6 pt-20">
      <div className="panel">
        <p className="font-semibold text-primary">PixelBloom</p>
        <h1 className="mt-3 text-2xl font-bold">Configure o ambiente</h1>
        <p className="mt-3 text-muted">Preencha a URL e a chave publicável do Supabase no arquivo .env.local. Consulte o README para iniciar o banco e aplicar as migrations.</p>
      </div>
    </main>
  );
}
