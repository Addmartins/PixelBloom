import { requireExperience } from "./access";
import { PixelAvatar } from "./pixel-avatar";
import { redeemReward, saveAvatar, setPixelOptIn } from "./pixel-actions";
import { ActionForm } from "@/features/organizations/action-form";
import { KidsPlay } from "./kids-play";
import { AvatarWardrobe } from "./avatar-shop/wardrobe";
import { demoCatalog } from "./avatar-shop/store";

type Context = Awaited<ReturnType<typeof requireExperience>>;

export async function PatientGarden({ context, slug }: { context: Context; slug: string }) {
  const { db, clinic, features } = context;
  const { data: patient, error } = await db.from("patients").select("id").eq("organization_id", clinic.id).eq("active", true).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o vínculo do paciente.");
  if (!patient) return <p className="panel text-muted">Peça à clínica para vincular sua conta ao seu cadastro.</p>;
  const { data: setting, error: settingsError } = await db.from("patient_pixel_settings").select("enabled").eq("organization_id", clinic.id).eq("patient_id", patient.id).maybeSingle();
  if (settingsError) throw new Error("Não foi possível carregar sua participação.");
  const optIn = !!setting?.enabled;
  const { data: controls, error: controlError } = await db.from("family_kids_controls")
    .select("paused,share_mood").eq("organization_id", clinic.id).eq("patient_id", patient.id).maybeSingle();
  if (controlError) throw new Error("Não foi possível carregar o controle parental.");
  if (controls?.paused) return <p className="panel">Seu responsável pausou o PixelBloom Kids.</p>;
  return (
    <>
      <section className="panel grid gap-3">
        <h2 className="text-xl font-semibold">Sua participação</h2>
        <p className="text-muted">{features?.pixel_world_enabled ? "O jardim é opcional. Você pode sair quando quiser." : "A clínica pausou a experiência."}</p>
        {(features?.pixel_world_enabled || optIn) && (
          <ActionForm action={setPixelOptIn.bind(null, slug)} label={optIn ? "Sair da experiência" : "Entrar no jardim"} secondary={optIn}>
            <input type="hidden" name="patientId" value={patient.id} />
            <input type="hidden" name="enabled" value={String(!optIn)} />
          </ActionForm>
        )}
      </section>
      {features?.pixel_world_enabled && optIn && <><a href="#loja-de-avatares" className="button justify-self-start">Abrir loja de avatares</a><KidsPlay slug={slug} patientId={patient.id} moodEnabled={!!controls?.share_mood} /><Garden context={context} patientId={patient.id} slug={slug} /></>}
    </>
  );
}

async function Garden({ context, patientId, slug }: { context: Context; patientId: string; slug: string }) {
  const { db, clinic } = context;
  const [avatar, inventory, rewards, balance, history] = await Promise.all([
    db.from("patient_avatars").select("palette,accessory").eq("organization_id", clinic.id).eq("patient_id", patientId).maybeSingle(),
    db.from("patient_inventory").select("reward_id,equipped_slot").eq("organization_id", clinic.id).eq("patient_id", patientId),
    db.from("rewards_catalog").select("id,name,description,price_points,active,avatar_accessory,cosmetic_code").eq("organization_id", clinic.id).eq("kind", "avatar").order("name"),
    db.rpc("reward_balance", { p_organization_id: clinic.id, p_patient_id: patientId }),
    db.from("reward_ledger").select("id,amount,transaction_type").eq("organization_id", clinic.id).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (avatar.error || inventory.error || rewards.error || balance.error || history.error) throw new Error("Não foi possível carregar o jardim.");
  const owned = new Set(inventory.data.map(item => item.reward_id));
  const customRewards = rewards.data.filter(item => item.cosmetic_code === null);
  const accessories = new Set(customRewards.filter(item => owned.has(item.id)).map(item => item.avatar_accessory));
  const catalog = new Map(rewards.data.map(item => [item.cosmetic_code, item]));
  const products = demoCatalog.flatMap(item => {
    const reward = catalog.get(item.cosmetic_code);
    return reward && (reward.active || owned.has(reward.id))
      ? [{ ...item, id: reward.id, nome: reward.name, preco_pontos: reward.price_points }] : [];
  });
  return (
    <>
      <AvatarWardrobe live={{
        products, balance: Number(balance.data ?? 0), slug, patientId,
        items: inventory.data.map(item => ({ id: item.reward_id, equipped: !!item.equipped_slot })),
      }} />
      <details className="panel">
        <summary className="cursor-pointer text-xl font-semibold">Avatar do jardim</summary>
        <div className="mt-4 grid gap-4">
        <PixelAvatar palette={avatar.data?.palette ?? "violet"} accessory={avatar.data?.accessory ?? "none"} />
        <ActionForm action={saveAvatar.bind(null, slug)} label="Salvar avatar">
          <input type="hidden" name="patientId" value={patientId} />
          <label className="grid gap-1">Cor<select name="palette" className="field" defaultValue={avatar.data?.palette ?? "violet"}><option value="violet">Violeta</option><option value="mint">Menta</option><option value="peach">Pêssego</option></select></label>
          <label className="grid gap-1">Acessório<select name="accessory" className="field" defaultValue={avatar.data?.accessory ?? "none"}><option value="none">Nenhum</option><option value="leaf">Folha</option><option value="star">Estrela</option>
            {accessories.has("crown") && <option value="crown">Coroa</option>}
            {accessories.has("butterfly") && <option value="butterfly">Borboleta</option>}
          </select></label>
        </ActionForm>
        </div>
      </details>
      {customRewards.length > 0 && <>
      <section className="panel grid gap-4">
        <h2 className="text-xl font-semibold">Inventário</h2>
        <p className="text-muted">{customRewards.some(item => owned.has(item.id)) ? customRewards.filter(item => owned.has(item.id)).map(item => item.name).join(", ") : "Você ainda não tem colecionáveis."}</p>
      </section>
      <section className="panel grid gap-4">
        <h2 className="text-xl font-semibold">Colecionáveis da clínica</h2>
        <p>Saldo de {String(balance.data ?? 0)} pontos</p>
        {customRewards.filter(item => item.active && !owned.has(item.id)).map(item => (
          <article key={item.id} className="grid gap-2 border-t border-border pt-3">
            <h3 className="font-semibold">{item.name} · {item.price_points} pontos</h3>
            {item.description && <p>{item.description}</p>}
            <ActionForm action={redeemReward.bind(null, slug)} label="Resgatar" secondary>
              <input type="hidden" name="patientId" value={patientId} />
              <input type="hidden" name="rewardId" value={item.id} />
            </ActionForm>
          </article>
        ))}
      </section>
      </>}
      {history.data.length > 0 && (
        <section className="panel grid gap-3">
          <h2 className="text-xl font-semibold">Movimentações recentes</h2>
          <ul className="grid gap-2">{history.data.map(item => <li key={item.id}>{item.transaction_type === "grant" ? "Pontos recebidos" : "Resgate"} · {item.amount > 0 ? "+" : ""}{item.amount}</li>)}</ul>
        </section>
      )}
    </>
  );
}
