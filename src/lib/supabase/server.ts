import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function createClient() {
  const store = await cookies();
  const config = supabaseConfig();
  if (!config) throw new Error("Configure a URL e a chave publicável do Supabase.");
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: "lax" },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components depend on the proxy to write refreshed cookies.
        }
      },
    },
  });
}
