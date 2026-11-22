import Link from "next/link";
import { getClinics } from "@/features/operations/tenancy";

export default async function KidsHome() {
  const clinics = (await getClinics()).filter(clinic => clinic.role === "patient");
  return <section className="panel grid gap-3">
    <h2 className="text-xl font-semibold">Sua clínica</h2>
    {clinics.length ? clinics.map(clinic => <Link key={clinic.id} className="button justify-self-start" href={`/kids/${clinic.slug}`}>{clinic.name}</Link>)
      : <p>Peça à clínica para vincular sua conta ao seu cadastro.</p>}
  </section>;
}
