"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clinicPath } from "@/features/operations/tenancy";
import type { Result } from "@/features/organizations/actions";
import { requireExperience } from "./access";

const toggle = z.enum(["true", "false"]).transform(value => value === "true");
const avatar = z.object({ palette: z.enum(["violet", "mint", "peach"]), accessory: z.enum(["none", "leaf", "star", "crown", "butterfly"]) });
const invalid = { ok: false, message: "Revise os campos." };

export async function setPixelOrganization(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const enabled = toggle.safeParse(form.get("enabled"));
  if (!enabled.success) return invalid;
  const { error } = await db.rpc("set_organization_pixel_world", { p_organization_id: clinic.id, p_enabled: enabled.data });
  if (error) return { ok: false, message: "Não foi possível atualizar a experiência da clínica." };
  revalidatePath(clinicPath(slug), "layout");
  return { ok: true, message: enabled.data ? "Pixel World ativado para a clínica." : "Pixel World pausado para a clínica." };
}

export async function setPixelOptIn(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const values = z.object({ patientId: z.uuid(), enabled: toggle }).safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.rpc("set_pixel_world_opt_in", {
    p_organization_id: clinic.id, p_patient_id: values.data.patientId, p_enabled: values.data.enabled,
  });
  if (error) return { ok: false, message: "Não foi possível atualizar sua participação." };
  revalidatePath(clinicPath(slug, "pixel-world"));
  revalidatePath(`/kids/${slug}`);
  return { ok: true, message: "Participação atualizada." };
}

export async function saveAvatar(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const values = avatar.extend({ patientId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.rpc("save_patient_avatar", {
    p_organization_id: clinic.id, p_patient_id: values.data.patientId, p_palette: values.data.palette, p_accessory: values.data.accessory,
  });
  if (error) return { ok: false, message: "Não foi possível salvar o avatar." };
  revalidatePath(clinicPath(slug, "pixel-world"));
  revalidatePath(`/kids/${slug}`);
  return { ok: true, message: "Avatar salvo." };
}

export async function createReward(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const values = z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(1000).transform(value => value || null),
    price_points: z.coerce.number().int().min(1).max(10000),
    kind: z.enum(["avatar", "physical"]).default("avatar"),
    avatar_accessory: z.enum(["", "crown", "butterfly"]).default("").transform(value => value || null),
  }).safeParse(Object.fromEntries(form));
  if (!values.success || (values.data.kind === "physical" && values.data.avatar_accessory)) return invalid;
  const { error } = await db.from("rewards_catalog").insert({ organization_id: clinic.id, ...values.data });
  if (error) return { ok: false, message: "Não foi possível cadastrar o colecionável." };
  revalidatePath(clinicPath(slug, "pixel-world"));
  revalidatePath(`/kids/${slug}`);
  return { ok: true, message: "Colecionável cadastrado." };
}

export async function grantPoints(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const values = z.object({
    patientId: z.uuid(),
    amount: z.coerce.number().int().min(1).max(10000),
    reason: z.string().trim().min(1).max(200),
  }).safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.rpc("grant_reward_points", {
    p_organization_id: clinic.id, p_patient_id: values.data.patientId, p_amount: values.data.amount, p_reason: values.data.reason,
  });
  if (error) return { ok: false, message: "Não foi possível conceder pontos. Confira se a participação está ativa." };
  revalidatePath(clinicPath(slug, "pixel-world"));
  revalidatePath(`/kids/${slug}`);
  return { ok: true, message: "Pontos concedidos." };
}

export async function redeemReward(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const values = z.object({ patientId: z.uuid(), rewardId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.rpc("redeem_reward", {
    p_organization_id: clinic.id, p_patient_id: values.data.patientId, p_reward_id: values.data.rewardId,
  });
  if (error) return { ok: false, message: "O resgate não pôde ser realizado. Confira seu saldo e a disponibilidade do item." };
  revalidatePath(clinicPath(slug, "pixel-world"));
  revalidatePath(`/kids/${slug}`);
  return { ok: true, message: "Colecionável adicionado ao inventário." };
}
