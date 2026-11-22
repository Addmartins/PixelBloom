import Link from 'next/link'
import { notFound } from 'next/navigation'
import { saveRegistry, toggleRegistry, type Registry } from './actions'
import { OperationForm } from './forms'
import { Availability } from './availability'
import { AccountLink } from './account-link'
import { ProfessionalPatients } from './professional-patients'
import { ProfessionalSpecialties } from './professional-specialties'
import { access, clinicPath, getClinic } from './tenancy'

type Entry = {
  id: string
  active: boolean
  profile_id?: string | null
  name?: string
  display_name?: string
  duration_minutes?: number
  registration_number?: string | null
  description?: string | null
  specialty_id?: string | null
}

const registries = {
  patients: {
    title: 'Pacientes', singular: 'paciente', fields: 'id,display_name,active,profile_id',
    order: 'display_name', description: 'Cadastros administrativos disponíveis para seu perfil.',
  },
  professionals: {
    title: 'Profissionais', singular: 'profissional', fields: 'id,display_name,registration_number,active,profile_id',
    order: 'display_name', description: 'Equipe cadastrada para os atendimentos da clínica.',
  },
  specialties: {
    title: 'Especialidades', singular: 'especialidade', fields: 'id,name,description,active',
    order: 'name', description: 'Associe especialidades aos serviços e à equipe.',
  },
  services: {
    title: 'Serviços', singular: 'serviço', fields: 'id,name,duration_minutes,description,active,specialty_id',
    order: 'name', description: 'Serviços e durações usados nos agendamentos.',
  },
} as const

type Specialty = { id: string; name: string; active: boolean }

function EntryFields({ registry, entry, specialties }: { registry: Registry; entry?: Entry; specialties: Specialty[] }) {
  const named = registry === 'services' || registry === 'specialties'
  const nameLabel = registry === 'services' ? 'Nome do serviço' : registry === 'specialties' ? 'Nome da especialidade' : 'Nome completo'
  return (
    <>
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <label>
        {nameLabel}
        <input className="field" name={named ? 'name' : 'display_name'} defaultValue={entry?.name ?? entry?.display_name}
          required minLength={2} maxLength={100} />
      </label>
      {registry === 'professionals' && (
        <label>Registro profissional <input className="field" name="registration_number" defaultValue={entry?.registration_number ?? ''} maxLength={60} /></label>
      )}
      {registry === 'services' && (
        <>
          <label>Duração em minutos <input className="field" name="duration_minutes" type="number" min={5} max={480} defaultValue={entry?.duration_minutes ?? 50} required /></label>
          <label>Especialidade
            <select className="field" name="specialty_id" defaultValue={entry?.specialty_id ?? ''}>
              <option value="">Sem especialidade</option>
              {specialties.filter(specialty => specialty.active || specialty.id === entry?.specialty_id).map(specialty => (
                <option key={specialty.id} value={specialty.id}>{specialty.name}{specialty.active ? '' : ' (inativa)'}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {named && <label>Descrição <textarea className="field" name="description" defaultValue={entry?.description ?? ''} maxLength={1000} rows={3} /></label>}
    </>
  )
}

export async function Catalog({ slug, registry, edit }: { slug: string; registry: Registry; edit?: string }) {
  const { db, clinic } = await getClinic(slug)
  if (['patient', 'guardian'].includes(clinic.role)) notFound()
  if (registry !== 'patients' && clinic.role === 'professional') notFound()
  const canManage = registry === 'patients' ? access.patients(clinic.role) : access.catalog(clinic.role)
  const metadata = registries[registry]
  const [result, specialties] = await Promise.all([
    db.from(registry).select(metadata.fields).eq('organization_id', clinic.id).order(metadata.order).overrideTypes<Entry[], { merge: false }>(),
    registry === 'services'
      ? db.from('specialties').select('id,name,active').eq('organization_id', clinic.id).order('name')
      : { data: [], error: null },
  ])
  if (result.error || specialties.error) throw new Error('Não foi possível carregar os cadastros.')
  const entries = result.data
  const specialtiesById = new Map(specialties.data.map(specialty => [specialty.id, specialty.name]))
  const entry = canManage ? entries.find(row => row.id === edit) : undefined
  const base = clinicPath(slug, registry)

  return (
    <>
      <header className="clinic-page-header"><h1>{metadata.title}</h1><p>{metadata.description}</p></header>
      <div className={canManage ? 'clinic-columns' : undefined}>
        <section className="panel clinic-section">
          <h2>Cadastros</h2>
          {entries.length === 0 ? <p className="clinic-empty">Nenhum cadastro disponível.</p> : (
            <ul className="clinic-list clinic-records">
              {entries.map(row => (
                <li key={row.id}>
                  <div>
                    <strong>{row.name ?? row.display_name}</strong>
                    <small>{row.duration_minutes ? `${row.duration_minutes} min · ` : ''}{row.registration_number ? `${row.registration_number} · ` : ''}{row.specialty_id ? `${specialtiesById.get(row.specialty_id) ?? 'Especialidade'} · ` : ''}{row.active ? 'Ativo' : 'Inativo'}</small>
                  </div>
                  {canManage && <Link className="button-secondary" href={`${base}?edit=${row.id}#cadastro`} aria-label={`Editar ${row.name ?? row.display_name}`}>Editar</Link>}
                </li>
              ))}
            </ul>
          )}
        </section>
        {canManage && (
          <section className="panel clinic-section" id="cadastro">
            <h2>{entry ? `Editar ${metadata.singular}` : `Cadastrar ${metadata.singular}`}</h2>
            <OperationForm key={`${slug}-${registry}-${entry?.id ?? 'new'}`} action={saveRegistry.bind(null, slug, registry)} label="Salvar cadastro">
              <EntryFields registry={registry} entry={entry} specialties={specialties.data} />
            </OperationForm>
            {entry && (
              <div className="clinic-form-tools">
                <Link href={base}>Novo cadastro</Link>
                <OperationForm action={toggleRegistry.bind(null, slug, registry)} label={entry.active ? 'Desativar' : 'Reativar'} compact>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="active" value={String(!entry.active)} />
                </OperationForm>
              </div>
            )}
            {entry && (registry === 'patients' || registry === 'professionals') && access.catalog(clinic.role) && <AccountLink slug={slug} registry={registry} recordId={entry.id} profileId={entry.profile_id} />}
            {entry && registry === 'professionals' && <ProfessionalSpecialties slug={slug} professionalId={entry.id} />}
            {entry && registry === 'professionals' && <Availability slug={slug} professionalId={entry.id} />}
            {entry && registry === 'professionals' && <ProfessionalPatients slug={slug} professionalId={entry.id} />}
          </section>
        )}
      </div>
    </>
  )
}
