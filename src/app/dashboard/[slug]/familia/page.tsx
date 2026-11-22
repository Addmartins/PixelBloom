import Link from "next/link";
import { notFound } from "next/navigation";
import { requireExperience } from "@/features/experience/access";
import { redeemPrize, saveControls } from "@/features/experience/family-actions";
import { moodLabels } from "@/features/experience/kids-content";
import { ActionForm } from "@/features/organizations/action-form";
import { clinicPath } from "@/features/operations/tenancy";

const formatDay = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export default async function FamilyPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ paciente?: string }>;
}) {
  const [{ slug }, { paciente }] = await Promise.all([params, searchParams]);
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  if (clinic.role !== "guardian") notFound();

  const patients = await db.from("patients").select("id,display_name")
    .eq("organization_id", clinic.id).eq("active", true).order("display_name");
  if (patients.error) throw new Error("Não foi possível carregar os vínculos.");
  const child = patients.data.find(item => item.id === paciente) ?? patients.data[0];
  const base = clinicPath(slug, "familia");
  const header = <header className="clinic-page-header grid gap-3">
    <h1>Área da família</h1>
    <Link href={clinicPath(slug, "agenda")} className="button-secondary justify-self-start">Ver agendamentos</Link>
  </header>;
  if (!child) return <>{header}<p className="panel">A clínica precisa autorizar um vínculo antes de liberar o controle parental.</p></>;

  const [controls, history, catalog, points, orders] = await Promise.all([
    db.from("family_kids_controls").select("paused,share_mood").eq("organization_id", clinic.id).eq("patient_id", child.id).maybeSingle(),
    db.from("kids_moods").select("day,mood").eq("organization_id", clinic.id).eq("patient_id", child.id).order("day", { ascending: false }).limit(30),
    db.from("rewards_catalog").select("id,name,description,price_points").eq("organization_id", clinic.id).eq("kind", "physical").eq("active", true).order("name"),
    db.rpc("family_points", { p_organization_id: clinic.id, p_patient_id: child.id }),
    db.from("patient_inventory").select("id,reward_id,personalization,fulfilled_at").eq("organization_id", clinic.id).eq("patient_id", child.id)
      .not("personalization", "is", null).order("acquired_at", { ascending: false }),
  ]);
  if (controls.error || history.error || catalog.error || points.error || orders.error) throw new Error("Não foi possível carregar a área da família.");
  const names = orders.data.length
    ? await db.from("rewards_catalog").select("id,name").eq("organization_id", clinic.id).in("id", orders.data.map(order => order.reward_id))
    : { data: [], error: null };
  if (names.error) throw new Error("Não foi possível carregar os prêmios resgatados.");
  const owned = new Set(orders.data.map(order => order.reward_id));

  return <div className="grid gap-5">
    {header}
    <nav className="flex flex-wrap gap-2" aria-label="Crianças vinculadas">
      {patients.data.map(item => <Link key={item.id} className={item.id === child.id ? "button" : "button-secondary"}
        aria-current={item.id === child.id ? "page" : undefined} href={`${base}?paciente=${item.id}`}>{item.display_name}</Link>)}
    </nav>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel grid content-start gap-3">
        <h2 className="text-xl font-semibold">Controle parental</h2>
        <ActionForm key={child.id} action={saveControls.bind(null, slug)} label="Salvar preferências">
          <input type="hidden" name="patientId" value={child.id} />
          <label><input type="checkbox" name="paused" defaultChecked={controls.data?.paused} /> Pausar o PixelBloom Kids</label>
          <label><input type="checkbox" name="shareMood" defaultChecked={controls.data?.share_mood} /> Permitir registros de emoções</label>
          <p className="text-sm text-muted">Desativar os registros apaga o histórico de emoções desta criança.</p>
        </ActionForm>
      </section>
      <section className="panel grid content-start gap-3">
        <h2 className="text-xl font-semibold">Histórico de emoções</h2>
        <p className="text-sm text-muted">Registros voluntários da criança para conversar em família.</p>
        {history.data.length ? <ul className="clinic-list">
          {history.data.map(entry => <li key={entry.day}>
            <time dateTime={entry.day}>{formatDay.format(new Date(entry.day))}</time>
            <strong>{moodLabels[entry.mood as keyof typeof moodLabels]}</strong>
          </li>)}
        </ul> : <p>Nenhum registro disponível.</p>}
      </section>
    </div>
    <section className="panel grid gap-4">
      <h2 className="text-xl font-semibold">Loja de prêmios físicos</h2>
      <p>{String(points.data ?? 0)} pontos disponíveis</p>
      {catalog.data.length === 0 && <p>A clínica ainda não tem prêmios disponíveis.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {catalog.data.map(item => <article className="grid gap-2 rounded-2xl border border-border p-4" key={item.id}>
          <h3 className="font-semibold">{item.name} · {item.price_points} pontos</h3>
          {item.description && <p>{item.description}</p>}
          {owned.has(item.id) ? <p>Já resgatado</p> : <ActionForm key={`${child.id}-${item.id}`} action={redeemPrize.bind(null, slug)} label="Resgatar prêmio">
            <input type="hidden" name="patientId" value={child.id} />
            <input type="hidden" name="rewardId" value={item.id} />
            <label className="grid gap-1">Nome ou texto para personalizar<input className="field" name="personalization" maxLength={60} required /></label>
          </ActionForm>}
        </article>)}
      </div>
      {orders.data.length > 0 && <><h3 className="font-semibold">Meus resgates</h3><ul className="clinic-list">
        {orders.data.map(order => <li key={order.id}>
          <span>{names.data.find(item => item.id === order.reward_id)?.name ?? "Prêmio"} · {order.personalization}</span>
          <strong>{order.fulfilled_at ? "Entregue" : "Aguardando retirada"}</strong>
        </li>)}
      </ul></>}
    </section>
  </div>;
}
