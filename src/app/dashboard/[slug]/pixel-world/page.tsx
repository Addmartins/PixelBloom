import { notFound, redirect } from "next/navigation";
import { requireExperience } from "@/features/experience/access";
import { createReward, grantPoints, setPixelOrganization } from "@/features/experience/pixel-actions";
import { fulfillPrize } from "@/features/experience/family-actions";
import { ActionForm } from "@/features/organizations/action-form";

type Context = Awaited<ReturnType<typeof requireExperience>>;

async function Administration({ context, slug }: { context: Context; slug: string }) {
  const { db, clinic, features } = context;
  const enabled = !!features?.pixel_world_enabled;
  const [patients, settings, rewards, orders] = await Promise.all([
    db.from("patients").select("id,display_name").eq("organization_id", clinic.id).eq("active", true).order("display_name"),
    db.from("patient_pixel_settings").select("patient_id").eq("organization_id", clinic.id).eq("enabled", true),
    db.from("rewards_catalog").select("id,name,price_points,kind,cosmetic_code").eq("organization_id", clinic.id).eq("active", true).order("name"),
    db.from("patient_inventory").select("id,patient_id,reward_id,personalization,fulfilled_at")
      .eq("organization_id", clinic.id).not("personalization", "is", null).order("acquired_at", { ascending: false }).limit(100),
  ]);
  if (patients.error || settings.error || rewards.error || orders.error) throw new Error("Não foi possível carregar o Pixel World.");
  const optedIn = new Set(settings.data.map(item => item.patient_id));
  const participants = patients.data.filter(patient => optedIn.has(patient.id));
  return (
    <>
      <section className="panel grid gap-3">
        <h2 className="text-xl font-semibold">Participação da clínica</h2>
        <p className="text-muted">{enabled ? "Ativa. Cada paciente escolhe se quer participar." : "Pausada."}</p>
        <ActionForm action={setPixelOrganization.bind(null, slug)} label={enabled ? "Pausar para a clínica" : "Ativar para a clínica"}>
          <input type="hidden" name="enabled" value={String(!enabled)} />
        </ActionForm>
      </section>
      {orders.data.length > 0 && <section className="panel grid gap-3">
        <h2 className="text-xl font-semibold">Resgates físicos</h2>
        {orders.data.map(order => <article key={order.id} className="grid gap-2 border-t border-border pt-3">
          <h3 className="font-semibold">{rewards.data.find(item => item.id === order.reward_id)?.name ?? "Prêmio"}</h3>
          <p>{patients.data.find(item => item.id === order.patient_id)?.display_name ?? "Paciente"} · {order.personalization}</p>
          {order.fulfilled_at ? <p>Entregue</p> : <ActionForm action={fulfillPrize.bind(null, slug, order.id)} label="Registrar entrega" secondary>{null}</ActionForm>}
        </article>)}
      </section>}
      {enabled && (
        <>
          <section className="panel grid gap-4">
            <h2 className="text-xl font-semibold">Catálogo de prêmios</h2>
            {rewards.data.filter(item => !item.cosmetic_code).map(item => <p key={item.id}>{item.name} · {item.kind === "physical" ? "Físico" : "Avatar"} · {item.price_points} pontos</p>)}
            <ActionForm action={createReward.bind(null, slug)} label="Adicionar ao catálogo">
              <label className="grid gap-1">Tipo<select name="kind" className="field"><option value="avatar">Item de avatar</option><option value="physical">Prêmio físico</option></select></label>
              <label className="grid gap-1">Nome<input name="name" className="field" maxLength={100} required /></label>
              <label className="grid gap-1">Acessório desbloqueável para item de avatar
                <select name="avatar_accessory" className="field"><option value="">Nenhum</option><option value="crown">Coroa</option><option value="butterfly">Borboleta</option></select>
              </label>
              <label className="grid gap-1">Descrição<textarea name="description" className="field" maxLength={1000} /></label>
              <label className="grid gap-1">Preço em pontos<input name="price_points" className="field" type="number" min={1} max={10000} required /></label>
            </ActionForm>
          </section>
          <section className="panel grid gap-4">
            <h2 className="text-xl font-semibold">Conceder pontos</h2>
            {participants.length ? (
              <ActionForm action={grantPoints.bind(null, slug)} label="Conceder">
                <label className="grid gap-1">Paciente<select name="patientId" className="field">{participants.map(patient => <option key={patient.id} value={patient.id}>{patient.display_name}</option>)}</select></label>
                <label className="grid gap-1">Quantidade<input name="amount" className="field" type="number" min={1} max={10000} required /></label>
                <label className="grid gap-1">Motivo lúdico, sem dados de saúde<input name="reason" className="field" maxLength={200} required /></label>
              </ActionForm>
            ) : <p className="text-muted">Nenhum paciente aderiu à experiência.</p>}
          </section>
        </>
      )}
    </>
  );
}

export default async function PixelWorld({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requireExperience(slug, "pixel_world");
  const { role } = context.clinic;
  if (role === "patient") redirect(`/kids/${slug}`);
  if (role !== "owner" && role !== "admin") notFound();
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-bold">Pixel World</h1>
      <Administration context={context} slug={slug} />
    </div>
  );
}
