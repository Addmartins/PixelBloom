import { afterEach, describe, expect, it, vi } from "vitest";
import { authOrigin, callbackUrl } from "../../src/features/auth/urls";

afterEach(() => vi.unstubAllEnvs());

describe("origem dos links de autenticação", () => {
  it("retorna a origem HTTP configurada", () => {
    expect(authOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
  });

  it.each(["", "pixelbloom.test", "ftp://pixelbloom.test", "https://user@pixelbloom.test"])(
    "rejeita configuração inválida: %s",
    (value) => expect(authOrigin(value)).toBeNull(),
  );

  it.each(["signup", "recovery"] as const)("monta o callback de %s", (flow) => {
    vi.stubEnv("APP_URL", "https://pixelbloom.test/");
    expect(callbackUrl(flow)).toBe(`https://pixelbloom.test/auth/callback?flow=${flow}`);
  });
});
