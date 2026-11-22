export function authOrigin(value = process.env.APP_URL): string | null {
  if (!value) return null;

  const url = URL.parse(value);
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;

  return url.origin;
}

export function callbackUrl(flow: "signup" | "recovery"): string | null {
  const origin = authOrigin();
  if (!origin) return null;

  const url = new URL("/auth/callback", origin);
  url.searchParams.set("flow", flow);
  return url.toString();
}
