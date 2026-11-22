"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, recoverySchema, registrationSchema, resetSchema } from "./schema";
import { parseLoginPortal, type LoginAccess } from "./login-access";
import { callbackUrl } from "./urls";

export type AuthResult = { message: string; kind: "error" | "success" };

export async function login(input: unknown, access?: LoginAccess): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { message: "Revise os campos.", kind: "error" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { message: "Confira o e-mail, a senha e a confirmação da conta.", kind: "error" };
  if (access === "kids") redirect("/kids");
  const portal = parseLoginPortal(access);
  redirect(portal ? `/dashboard?acesso=${portal}` : "/dashboard");
}

export async function register(input: unknown): Promise<AuthResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { message: "Revise os campos.", kind: "error" };
  const emailRedirectTo = callbackUrl("signup");
  if (!emailRedirectTo) return { message: "O cadastro está indisponível neste ambiente.", kind: "error" };
  const supabase = await createClient();
  const { email, password, displayName } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo, data: { display_name: displayName } },
  });
  if (error) return { message: "Não foi possível solicitar o cadastro. Tente novamente.", kind: "error" };
  if (data.session) redirect("/dashboard");
  return { message: "Confira sua caixa de entrada para confirmar o cadastro.", kind: "success" };
}

export async function recover(input: unknown): Promise<AuthResult> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) return { message: "Informe um e-mail válido.", kind: "error" };
  const redirectTo = callbackUrl("recovery");
  if (!redirectTo) return { message: "A recuperação está indisponível neste ambiente.", kind: "error" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  return { message: "Se a conta estiver cadastrada, você receberá um link de recuperação.", kind: "success" };
}

export async function resetPassword(input: unknown): Promise<AuthResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { message: "Revise a senha.", kind: "error" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { message: "Abra um novo link de recuperação para continuar.", kind: "error" };
  const { error } = await supabase.auth.updateUser(parsed.data);
  if (error) return { message: "Não foi possível atualizar a senha. Use outra senha ou solicite um novo link.", kind: "error" };
  redirect("/dashboard");
}

async function endSession() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function logoutFromKids() {
  await endSession();
  redirect("/login?app=kids");
}
