import { describe, expect, it } from "vitest";
import { dateAtRecife, recifeDay, resolveDay, shiftDay } from "../../src/features/operations/schedule";

describe("datas da agenda", () => {
  it("converte o horário informado em Recife para o instante UTC", () => {
    expect(dateAtRecife("2026-11-22T09:30")?.toISOString()).toBe("2026-11-22T12:30:00.000Z");
  });

  it("mantém o dia operacional de Recife perto da meia-noite UTC", () => {
    expect(recifeDay(new Date("2026-11-23T02:59:59Z"))).toBe("2026-11-22");
    expect(recifeDay(new Date("2026-11-23T03:00:00Z"))).toBe("2026-11-23");
  });

  it("rejeita datas impossíveis e formatos inesperados", () => {
    expect(dateAtRecife("2026-02-30T09:00")).toBeNull();
    expect(dateAtRecife("2026-11-22T24:00")).toBeNull();
    expect(dateAtRecife("2026-11-22T09:00:45")).toBeNull();
    expect(resolveDay("2028-02-29")).toBe("2028-02-29");
  });

  it("navega por limites de mês e ano", () => {
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29");
  });
});
