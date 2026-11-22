import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordSchema,
  recoverySchema,
  registrationSchema,
} from "../../src/features/auth/schema";

describe("validação de autenticação", () => {
  it("valida os campos de entrada e recuperação", () => {
    expect(loginSchema.safeParse({ email: "pessoa@example.test", password: "senha-legada" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "endereco-invalido", password: "uma-senha-segura" }).success).toBe(false);
    expect(recoverySchema.safeParse({ email: "pessoa@example.test" }).success).toBe(true);
    expect(recoverySchema.safeParse({ email: "endereco-invalido" }).success).toBe(false);
  });

  it("valida o cadastro com os dados obrigatórios", () => {
    const data = { displayName: "Pessoa Sintética", email: "pessoa@example.test", password: "uma-senha-segura" };
    expect(registrationSchema.safeParse(data).success).toBe(true);
    expect(registrationSchema.safeParse({ ...data, displayName: "" }).success).toBe(false);
  });

  it("aplica os limites em bytes a novas senhas", () => {
    expect(passwordSchema.safeParse("x".repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse("x".repeat(12)).success).toBe(true);
    expect(passwordSchema.safeParse("é".repeat(36)).success).toBe(true);
    expect(passwordSchema.safeParse("é".repeat(37)).success).toBe(false);
  });
});
