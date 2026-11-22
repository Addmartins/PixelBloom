import { notFound } from "next/navigation";
import { requireExperience } from "@/features/experience/access";
import { PatientGarden } from "@/features/experience/kids-garden";

export default async function KidsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await requireExperience(slug, "pixel_world");
  if (context.clinic.role !== "patient") notFound();
  return <PatientGarden context={context} slug={slug} />;
}
