"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExperience } from "../access";

export async function changeShopItem(slug: string, patientId: string, rewardId: string, operation: string) {
  const valid = z.tuple([z.uuid(), z.uuid(), z.enum(["buy", "equip", "unequip"])]).safeParse([patientId, rewardId, operation]);
  if (!valid.success) return { error: "Item indisponível." };
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const params = { p_organization_id: clinic.id, p_patient_id: patientId, p_reward_id: rewardId };
  const { error } = operation === "buy"
    ? await db.rpc("redeem_reward", params)
    : await db.rpc("equip_kids_avatar_item", { ...params, p_equipped: operation === "equip" });
  if (error) return { error: operation === "buy" ? "Confira o saldo e a disponibilidade do item." : "Não foi possível atualizar seu avatar." };
  revalidatePath(`/kids/${slug}`);
  return { error: null };
}
