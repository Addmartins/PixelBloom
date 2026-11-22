import { requireExperience } from "@/features/experience/access";
import { archiveAnnouncement, publishAnnouncement } from "@/features/experience/actions";
import { ActionForm } from "@/features/organizations/action-form";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Recife" });

export default async function Announcements({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, clinic } = await requireExperience(slug, "announcements");
  const manage = clinic.role === "owner" || clinic.role === "admin";
  const { data, error } = await db.from("announcements").select("id,title,content,active,published_at").eq("organization_id", clinic.id).order("published_at", { ascending: false }).limit(100);
  if (error) throw new Error("Não foi possível carregar os avisos.");
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-bold">Avisos</h1>
      {manage && (
        <section className="panel grid gap-4">
          <h2 className="text-xl font-semibold">Publicar aviso</h2>
          <ActionForm action={publishAnnouncement.bind(null, slug)} label="Publicar">
            <label className="grid gap-1">Título<input required name="title" className="field" maxLength={150} /></label>
            <label className="grid gap-1">Mensagem<textarea required name="content" className="field" maxLength={4000} rows={4} /></label>
          </ActionForm>
        </section>
      )}
      {data.length === 0 && <p className="panel text-muted">Nenhum aviso publicado.</p>}
      {data.map(item => (
        <article key={item.id} className="panel grid gap-3">
          <h2 className="text-xl font-semibold">{item.title}</h2>
          <p className="text-sm text-muted"><time dateTime={item.published_at}>{dateFormat.format(new Date(item.published_at))}</time>{!item.active && " · Arquivado"}</p>
          <p className="whitespace-pre-wrap break-words">{item.content}</p>
          {manage && item.active && <ActionForm action={archiveAnnouncement.bind(null, slug)} label="Arquivar" secondary><input type="hidden" name="id" value={item.id} /></ActionForm>}
        </article>
      ))}
    </div>
  );
}
