import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Informe um e-mail válido."));

export const passwordSchema = z.string()
  .min(12, "Use pelo menos 12 caracteres.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "A senha pode ter até 72 bytes.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha.").max(256),
});
export const registrationSchema = z.object({
  displayName: z.string().trim().min(2, "Informe seu nome.").max(100),
  email,
  password: passwordSchema,
});
export const recoverySchema = z.object({ email });
export const resetSchema = z.object({ password: passwordSchema });
