"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clinicPath, getClinic, getSession } from "@/features/operations/tenancy";

export type Result = { message: string; ok: boolean; token?: string };

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  role: z.enum(["admin", "manager", "reception", "professional", "guardian", "patient"]),
});

export async function invite(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const { db, clinic } = await getClinic(slug);
  const values = inviteSchema.safeParse(Object.fromEntries(form));
  if (!values.success || !["owner", "admin"].includes(clinic.role)) {
    return { message: "Confira os campos e as permissões.", ok: false };
  }
  const { data, error } = await db.rpc("create_organization_invite", {
    p_organization_id: clinic.id,
    p_email: values.data.email,
    p_role: values.data.role,
  });
  if (error || typeof data !== "string") return { message: "Não foi possível emitir o convite. Verifique se já existe um convite pendente para este e-mail.", ok: false };
  revalidatePath(clinicPath(slug, "membros"));
  return { message: "Compartilhe este código diretamente com a pessoa convidada.", ok: true, token: data };
}

export async function revokeInvite(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const id = z.uuid().safeParse(form.get("id"));
  const { db, clinic } = await getClinic(slug);
  if (!id.success) return { message: "Convite inválido.", ok: false };
  const { error } = await db.rpc("revoke_organization_invite", {
    p_organization_id: clinic.id,
    p_invite_id: id.data,
  });
  if (error) return { message: "Não foi possível revogar o convite.", ok: false };
  revalidatePath(clinicPath(slug, "membros"));
  return { message: "Convite revogado.", ok: true };
}

export async function acceptInvite(_state: Result | null, form: FormData): Promise<Result> {
  const token = z.string().trim().regex(/^[a-f\d]{64}$/).safeParse(form.get("token"));
  if (!token.success) return { message: "Confira o código do convite.", ok: false };
  const { db } = await getSession();
  const { error } = await db.rpc("accept_organization_invite", { p_token: token.data });
  if (error) return { message: "O convite está indisponível para esta conta. Use o e-mail confirmado que recebeu o código.", ok: false };
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function updateProfile(_state: Result | null, form: FormData): Promise<Result> {
  const name = z.string().trim().min(2).max(100).safeParse(form.get("displayName"));
  if (!name.success) return { message: "Informe um nome com 2 a 100 caracteres.", ok: false };
  const { db, user } = await getSession();
  const { data, error } = await db.from("profiles").update({ display_name: name.data }).eq("id", user.id).select("id").maybeSingle();
  if (error || !data) return { message: "Não foi possível atualizar o perfil.", ok: false };
  revalidatePath("/conta/perfil");
  return { message: "Perfil atualizado.", ok: true };
}

export async function setMemberStatus(slug: string, _state: Result | null, form: FormData): Promise<Result> {
  const fields = z.object({ id: z.uuid(), status: z.enum(["active", "revoked"]) }).safeParse(Object.fromEntries(form));
  if (!fields.success) return { message: "Vínculo inválido.", ok: false };
  const { db, clinic } = await getClinic(slug);
  const { error } = await db.rpc("set_organization_membership_status", {
    p_organization_id: clinic.id, p_membership_id: fields.data.id, p_status: fields.data.status,
  });
  if (error) return { message: "Não foi possível alterar o vínculo.", ok: false };
  revalidatePath(clinicPath(slug, "membros"));
  return { message: "Vínculo atualizado.", ok: true };
}
