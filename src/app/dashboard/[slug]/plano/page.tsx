import { notFound } from "next/navigation";
import { getClinic } from "@/features/operations/tenancy";

export default async function Plan({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, clinic } = await getClinic(slug);
  if (clinic.role !== "owner") notFound();
  const [subscription, plans] = await Promise.all([
    db.from("subscriptions").select("plan_id,status").eq("organization_id", clinic.id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("plans").select("id,name,limits").eq("active", true).order("name"),
  ]);
  if (subscription.error || plans.error) throw new Error("Não foi possível carregar os planos.");
  const plan = plans.data.find(item => item.id === subscription.data?.plan_id);
  const limit = (plan?.limits as { active_professionals?: number } | undefined)?.active_professionals;
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-bold">Plano</h1>
      <section className="panel">
        <h2 className="text-lg font-semibold">Plano da organização</h2>
        <p className="mt-2 text-2xl font-bold">{plan?.name ?? "Plano indisponível"}</p>
        <p className="mt-3 text-muted">{limit === undefined ? "Limite de profissionais ativos ainda sem configuração." : `Limite de profissionais ativos · ${limit}`}</p>
        <p className="mt-2 text-muted">A cobrança está em preparação.</p>
      </section>
    </div>
  );
}
