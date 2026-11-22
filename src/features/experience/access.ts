import { cache } from "react";
import { notFound } from "next/navigation";
import { getClinic } from "@/features/operations/tenancy";

export const getExperience = cache(async (slug: string) => {
  const context = await getClinic(slug);
  const { data, error } = await context.db.rpc("organization_features", { p_organization_id: context.clinic.id });
  if (error) throw new Error("Não foi possível carregar os recursos do plano.");
  const features = data as {
    activities?: boolean;
    announcements?: boolean;
    pixel_world?: boolean;
    pixel_world_enabled?: boolean;
  } | null;
  return { ...context, features };
});

export async function requireExperience(slug: string, feature: "activities" | "announcements" | "pixel_world") {
  const context = await getExperience(slug);
  if (!context.features?.[feature]) notFound();
  return context;
}
