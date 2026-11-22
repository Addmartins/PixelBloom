import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto max-w-lg p-5 pt-14">
      <section className="panel grid gap-4">
        <h1 className="text-2xl font-bold">Página indisponível</h1>
        <Link className="button-secondary justify-self-start" href="/dashboard">Minhas organizações</Link>
      </section>
    </div>
  );
}
