import { notFound } from "next/navigation";
import { requireExperience } from "@/features/experience/access";
import { assignActivity, completeActivity, createActivity } from "@/features/experience/actions";
import { ActionForm } from "@/features/organizations/action-form";

export default async function Activities({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, clinic } = await requireExperience(slug, "activities");
  if (clinic.role === "reception" || clinic.role === "manager") notFound();
  const manage = clinic.role === "owner" || clinic.role === "admin";
  const canAssign = manage || clinic.role === "professional";

  const [catalog, assignments, patients] = await Promise.all([
    db.from("activities").select("id,name,description,instructions,active").eq("organization_id", clinic.id).order("name"),
    db.from("patient_activities").select("id,activity_id,patient_id,status").eq("organization_id", clinic.id).order("created_at", { ascending: false }).limit(100),
    db.from("patients").select("id,display_name,active").eq("organization_id", clinic.id).order("display_name"),
  ]);
  if (catalog.error || assignments.error || patients.error) throw new Error("Não foi possível carregar as atividades.");
  const active = catalog.data.filter(activity => activity.active);
  const eligible = patients.data.filter(patient => patient.active);
  const activitiesById = new Map(catalog.data.map(activity => [activity.id, activity]));
  const patientsById = new Map(patients.data.map(patient => [patient.id, patient.display_name]));

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-bold">Atividades</h1>
      {manage && (
        <section className="panel grid gap-4">
          <h2 className="text-xl font-semibold">Nova atividade</h2>
          <ActionForm action={createActivity.bind(null, slug)} label="Criar atividade">
            <label className="grid gap-1">Nome<input required name="name" maxLength={100} className="field" /></label>
            <label className="grid gap-1">Descrição<textarea name="description" maxLength={1000} className="field" /></label>
            <label className="grid gap-1">Instruções<textarea name="instructions" maxLength={4000} className="field" /></label>
          </ActionForm>
        </section>
      )}
      {canAssign && (
        <section className="panel grid gap-4">
          <h2 className="text-xl font-semibold">Atribuir atividade</h2>
          {active.length && eligible.length ? (
            <ActionForm action={assignActivity.bind(null, slug)} label="Atribuir">
              <label className="grid gap-1">Atividade<select name="activity_id" className="field">{active.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label>
              <label className="grid gap-1">Paciente<select name="patient_id" className="field">{eligible.map(patient => <option key={patient.id} value={patient.id}>{patient.display_name}</option>)}</select></label>
            </ActionForm>
          ) : <p className="text-muted">É preciso ter um paciente acessível e uma atividade ativa.</p>}
        </section>
      )}
      <section className="panel grid gap-4">
        <h2 className="text-xl font-semibold">Atividades atribuídas</h2>
        {assignments.data.length === 0 && <p className="text-muted">Nenhuma atividade atribuída.</p>}
        <ul className="divide-y divide-border">
          {assignments.data.map(item => {
            const activity = activitiesById.get(item.activity_id);
            const patient = patientsById.get(item.patient_id);
            return (
              <li key={item.id} className="grid gap-2 py-3">
                <p className="font-semibold">{activity?.name ?? "Atividade"}{patient ? ` · ${patient}` : ""}</p>
                {activity?.description && <p className="whitespace-pre-wrap break-words">{activity.description}</p>}
                {activity?.instructions && <p className="whitespace-pre-wrap break-words">{activity.instructions}</p>}
                <p className="text-sm text-muted">{item.status === "completed" ? "Concluída" : "Pendente"}</p>
                {clinic.role === "patient" && item.status === "assigned" && (
                  <ActionForm action={completeActivity.bind(null, slug)} label="Marcar como concluída" secondary><input type="hidden" name="id" value={item.id} /></ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
