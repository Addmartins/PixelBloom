import Link from "next/link";
import { getSession } from "@/features/operations/tenancy";
import { ActionForm } from "@/features/organizations/action-form";
import { acceptInvite } from "@/features/organizations/actions";

export default async function Invitation() {
  const { user } = await getSession();
  return (
    <main className="mx-auto grid max-w-lg gap-4 p-5 pt-16">
      <Link href="/dashboard" className="text-primary">Voltar às organizações</Link>
      <section className="panel grid gap-4">
        <h1 className="text-2xl font-bold">Aceitar convite</h1>
        <p className="text-muted">Conta atual: {user.email}</p>
        <ActionForm action={acceptInvite} label="Aceitar convite">
          <label className="grid gap-1">Código do convite<input className="field" name="token" required size={30} maxLength={64} autoComplete="off" spellCheck={false} /></label>
        </ActionForm>
      </section>
    </main>
  );
}
