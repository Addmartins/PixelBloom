"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-lg p-5 pt-14">
      <section className="panel grid gap-4" role="alert">
        <h1 className="text-2xl font-bold">Não foi possível carregar esta página</h1>
        <p className="text-muted">Tente recarregar ou retorne às suas organizações.</p>
        <div className="flex flex-wrap gap-2">
          <button className="button" type="button" onClick={reset}>Tentar novamente</button>
          <Link className="button-secondary" href="/dashboard">Minhas organizações</Link>
        </div>
      </section>
    </main>
  );
}
