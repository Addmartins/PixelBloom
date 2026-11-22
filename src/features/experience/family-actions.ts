"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clinicPath } from "@/features/operations/tenancy";
import type { Result } from "@/features/organizations/actions";
import { requireExperience } from "./access";
import { moods } from "./kids-content";

const patient = z.object({ patientId: z.uuid() });
const invalid = { ok: false, message: "Revise os campos." };
const success = (message: string) => ({ ok: true, message });
const failure = (message: string) => ({ ok: false, message });

export async function saveControls(slug: string, _state: Result | null, form: FormData) {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const values = patient.safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.rpc("set_family_kids_controls", {
    p_organization_id: clinic.id, p_patient_id: values.data.patientId,
    p_paused: form.get("paused") === "on", p_share_mood: form.get("shareMood") === "on",
  });
  if (error) return failure("Não foi possível atualizar o controle parental.");
  revalidatePath(clinicPath(slug, "familia"));
  revalidatePath(`/kids/${slug}`);
  return success("Preferências salvas.");
}

export async function saveMood(slug: string, patientId: string, _state: Result | null, form: FormData) {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const mood = z.enum(moods).safeParse(form.get("mood"));
  if (!mood.success) return invalid;
  const { error } = await db.rpc("save_kids_mood", {
    p_organization_id: clinic.id, p_patient_id: patientId, p_mood: mood.data,
  });
  if (error) return failure("O registro está indisponível.");
  revalidatePath(`/kids/${slug}`);
  return success("Sua emoção de hoje foi registrada.");
}

export async function finishGame(slug: string, patientId: string, game: string, _state: Result | null, form: FormData) {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const answers = z.array(z.string().max(24)).length(3).safeParse([form.get("answer-0"), form.get("answer-1"), form.get("answer-2")]);
  if (!answers.success) return invalid;
  const { data, error } = await db.rpc("finish_kids_game", {
    p_organization_id: clinic.id, p_patient_id: patientId, p_game: game, p_answers: answers.data,
  });
  if (error) return failure(error.code === "22023" ? "Confira as respostas e tente novamente." : "O jogo está indisponível.");
  revalidatePath(`/kids/${slug}`);
  return success(data ? "Você ganhou 5 pontos!" : "Você já ganhou pontos neste jogo hoje.");
}

export async function redeemPrize(slug: string, _state: Result | null, form: FormData) {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const values = patient.extend({
    rewardId: z.uuid(), personalization: z.string().trim().min(1).max(60),
  }).safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.rpc("redeem_family_prize", {
    p_organization_id: clinic.id, p_patient_id: values.data.patientId, p_reward_id: values.data.rewardId,
    p_personalization: values.data.personalization,
  });
  if (error) return failure("Não foi possível resgatar. Confira o saldo e a disponibilidade do prêmio.");
  revalidatePath(clinicPath(slug, "familia"));
  revalidatePath(clinicPath(slug, "pixel-world"));
  revalidatePath(`/kids/${slug}`);
  return success("Resgate registrado. Combine a retirada com a clínica.");
}

export async function fulfillPrize(slug: string, orderId: string) {
  const { db, clinic } = await requireExperience(slug, "pixel_world");
  const { error } = await db.rpc("fulfill_family_prize", { p_organization_id: clinic.id, p_order_id: orderId });
  if (error) return failure("Não foi possível registrar a entrega.");
  revalidatePath(clinicPath(slug, "pixel-world"));
  return success("Entrega registrada.");
}
