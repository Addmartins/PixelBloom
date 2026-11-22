export type LoginPortal = "corporativo" | "familia";
export type LoginAccess = LoginPortal | "kids";

export function parseLoginPortal(value: unknown): LoginPortal | undefined {
  return value === "corporativo" || value === "familia" ? value : undefined;
}
