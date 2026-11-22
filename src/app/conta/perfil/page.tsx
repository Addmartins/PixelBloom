import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { getSession } from "@/features/operations/tenancy";
import { ActionForm } from "@/features/organizations/action-form";
import { updateProfile } from "@/features/organizations/actions";

export default async function Profile() {
  const { db, user } = await getSession();
  const { data, error } = await db.from("profiles").select("display_name").eq("id", user.id).single();
  if (error) throw new Error("Não foi possível carregar o perfil.");
  return (
    <main className="mx-auto grid max-w-lg gap-4 p-5 pt-16">
      <Link href="/dashboard" className="text-primary">Voltar às organizações</Link>
      <section className="panel grid gap-4">
        <h1 className="text-2xl font-bold">Meu perfil</h1>
        <p className="text-muted">{user.email}</p>
        <ActionForm action={updateProfile} label="Salvar">
          <label className="grid gap-1">Nome<input className="field" name="displayName" required maxLength={100} defaultValue={data.display_name} /></label>
        </ActionForm>
      </section>
      <form action={logout}><button className="button-secondary">Sair</button></form>
    </main>
  );
}
