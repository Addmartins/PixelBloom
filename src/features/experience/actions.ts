"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clinicPath } from "@/features/operations/tenancy";
import type { Result } from "@/features/organizations/actions";
import { requireExperience } from "./access";

const optionalText = (limit: number) => z.string().trim().max(limit).transform(value => value || null);
const invalid = { ok: false, message: "Revise os campos." };

export async function createActivity(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "activities");
  const values = z.object({ name: z.string().trim().min(2).max(100), description: optionalText(1000), instructions: optionalText(4000) }).safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.from("activities").insert({ organization_id: clinic.id, ...values.data });
  if (error) return { ok: false, message: "Não foi possível criar a atividade." };
  revalidatePath(clinicPath(slug, "atividades"));
  return { ok: true, message: "Atividade criada." };
}

export async function assignActivity(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "activities");
  const values = z.object({ patient_id: z.uuid(), activity_id: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.from("patient_activities").insert({ organization_id: clinic.id, ...values.data });
  if (error) return { ok: false, message: "Não foi possível atribuir a atividade ao paciente." };
  revalidatePath(clinicPath(slug, "atividades"));
  return { ok: true, message: "Atividade atribuída." };
}

export async function completeActivity(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "activities");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return invalid;
  const { error } = await db.rpc("complete_patient_activity", { p_organization_id: clinic.id, p_assignment_id: id.data });
  if (error) return { ok: false, message: "Não foi possível concluir a atividade." };
  revalidatePath(clinicPath(slug, "atividades"));
  return { ok: true, message: "Atividade concluída." };
}

export async function publishAnnouncement(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "announcements");
  const values = z.object({ title: z.string().trim().min(2).max(150), content: z.string().trim().min(1).max(4000) }).safeParse(Object.fromEntries(form));
  if (!values.success) return invalid;
  const { error } = await db.from("announcements").insert({ organization_id: clinic.id, ...values.data });
  if (error) return { ok: false, message: "Não foi possível publicar o aviso." };
  revalidatePath(clinicPath(slug, "avisos"));
  return { ok: true, message: "Aviso publicado." };
}

export async function archiveAnnouncement(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await requireExperience(slug, "announcements");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return invalid;
  const { data, error } = await db.from("announcements").update({ active: false }).eq("organization_id", clinic.id).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "Não foi possível arquivar o aviso." };
  revalidatePath(clinicPath(slug, "avisos"));
  return { ok: true, message: "Aviso arquivado." };
}
