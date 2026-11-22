import { notFound } from "next/navigation";
import { getClinic, roleLabels, type Role } from "@/features/operations/tenancy";
import { ActionForm } from "@/features/organizations/action-form";
import { invite, revokeInvite, setMemberStatus } from "@/features/organizations/actions";

const restrictedRoles = ["reception", "professional", "guardian", "patient"] as const;
function isExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now();
}

const invitationStatus: Record<string, string> = {
  pending: "Pendente", accepted: "Aceito", revoked: "Revogado", expired: "Expirado",
};

export default async function Members({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, clinic } = await getClinic(slug);
  if (!["owner", "admin"].includes(clinic.role)) notFound();
  const roles = clinic.role === "owner" ? (["admin", "manager", ...restrictedRoles] as const) : restrictedRoles;
  const [invites, members] = await Promise.all([
    db.from("organization_invites").select("id,email,role,status,expires_at").eq("organization_id", clinic.id).order("created_at", { ascending: false }).limit(50),
    db.rpc("organization_member_directory", { p_organization_id: clinic.id }),
  ]);
  if (invites.error || members.error) throw new Error("Não foi possível carregar os membros e convites.");

  const directory = members.data as { id: string; display_name: string; role: Role; status: "active" | "revoked" }[];
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-bold">Membros e convites</h1>
      <section className="panel grid gap-4">
        <h2 className="text-xl font-semibold">Emitir convite</h2>
        <ActionForm action={invite.bind(null, slug)} label="Gerar código">
          <label className="grid gap-1">E-mail da pessoa convidada<input name="email" type="email" className="field" required maxLength={254} /></label>
          <label className="grid gap-1">Papel<select name="role" className="field">{roles.map(role => <option value={role} key={role}>{roleLabels[role]}</option>)}</select></label>
        </ActionForm>
      </section>
      <section className="panel">
        <h2 className="text-xl font-semibold">Convites recentes</h2>
        {invites.data.length === 0 ? <p className="mt-3 text-muted">Nenhum convite emitido.</p> :
          <ul className="mt-3 divide-y divide-border">
            {invites.data.map(item => {
              const status = item.status === "pending" && isExpired(item.expires_at) ? "expired" : item.status;
              return (
                <li className="grid gap-3 break-all py-3 sm:flex sm:items-center sm:justify-between" key={item.id}>
                  <div><p className="font-medium">{item.email}</p><p className="text-sm text-muted">{roleLabels[item.role as Role]} · {invitationStatus[status]}</p></div>
                  {status === "pending" && roles.some(role => role === item.role) &&
                    <ActionForm action={revokeInvite.bind(null, slug)} label="Revogar" secondary><input type="hidden" name="id" value={item.id} /></ActionForm>}
                </li>
              );
            })}
          </ul>}
      </section>
      <section className="panel">
        <h2 className="text-xl font-semibold">Vínculos da organização</h2>
        <ul className="mt-3 grid gap-2">
          {directory.map(member => (
            <li key={member.id} className="grid gap-3 border-b border-border py-3 sm:flex sm:items-center sm:justify-between">
              <div><p className="font-medium">{member.display_name}</p><p className="text-sm text-muted">{roleLabels[member.role]} · {member.status === "active" ? "Ativo" : "Revogado"}</p></div>
              {roles.some(role => role === member.role) && (
                <ActionForm action={setMemberStatus.bind(null, slug)} label={member.status === "active" ? "Revogar vínculo" : "Reativar vínculo"} secondary>
                  <input type="hidden" name="id" value={member.id} />
                  <input type="hidden" name="status" value={member.status === "active" ? "revoked" : "active"} />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
