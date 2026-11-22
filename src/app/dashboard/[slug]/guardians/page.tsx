import Link from 'next/link'
import { notFound } from 'next/navigation'
import { addGuardianPatient, saveGuardian, updateGuardianPatient } from '@/features/operations/actions'
import { AccountLink } from '@/features/operations/account-link'
import { OperationForm } from '@/features/operations/forms'
import { access, clinicPath, getClinic } from '@/features/operations/tenancy'

const statuses = {
  pending: 'Pendente',
  authorized: 'Autorizado',
  revoked: 'Revogado',
}

function RelationshipFields({ relationship = '', status = 'pending' }: { relationship?: string; status?: string }) {
  return <>
    <label>Relação com o paciente <input className="field" name="relationship" defaultValue={relationship} required minLength={2} maxLength={100} /></label>
    <label>Autorização
      <select className="field" name="authorization_status" defaultValue={status} required>
        {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  </>
}

export default async function GuardiansPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const [{ slug }, { edit }] = await Promise.all([params, searchParams])
  const { db, clinic } = await getClinic(slug)
  const canManage = access.catalog(clinic.role)
  const isGuardian = clinic.role === 'guardian'
  if (!canManage && !['guardian', 'reception'].includes(clinic.role)) notFound()

  const [guardians, patients, links] = await Promise.all([
    db.from('guardians').select('id,display_name,profile_id').eq('organization_id', clinic.id).order('display_name'),
    db.from('patients').select('id,display_name,active').eq('organization_id', clinic.id).order('display_name'),
    db.from('patient_guardians').select('id,patient_id,guardian_id,relationship,authorization_status').eq('organization_id', clinic.id),
  ])
  if (guardians.error || patients.error || links.error) throw new Error('Não foi possível carregar os responsáveis.')
  const base = clinicPath(slug, 'guardians')
  const selected = canManage && typeof edit === 'string' ? guardians.data.find(guardian => guardian.id === edit) : undefined
  const names = new Map(patients.data.map(patient => [patient.id, patient.display_name]))
  const linksByGuardian = Map.groupBy(links.data, link => link.guardian_id)
  const linked = new Set(selected ? linksByGuardian.get(selected.id)?.map(link => link.patient_id) : [])
  const available = patients.data.filter(patient => patient.active && !linked.has(patient.id))

  return <>
    <header className="clinic-page-header"><h1>{isGuardian ? 'Pacientes vinculados' : 'Responsáveis'}</h1></header>
    <div className={canManage ? 'clinic-columns' : undefined}>
      <section className="panel clinic-section">
        <h2>{isGuardian ? 'Meus vínculos' : 'Cadastros'}</h2>
        {guardians.data.length === 0 ? <p className="clinic-empty">Nenhum vínculo disponível.</p> : (
          <ul className="clinic-list clinic-appointments">
            {guardians.data.map(guardian => (
              <li key={guardian.id}>
                <div className="clinic-appointment-row">
                  <strong>{guardian.display_name}</strong>
                  {canManage && <Link className="button-secondary" href={`${base}?edit=${guardian.id}#cadastro`}>Editar</Link>}
                </div>
                {linksByGuardian.get(guardian.id)?.filter(link => names.has(link.patient_id)).map(link => (
                  <p key={link.id}>{names.get(link.patient_id)} · {link.relationship} · {statuses[link.authorization_status as keyof typeof statuses]}</p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
      {canManage && (
        <section className="panel clinic-section" id="cadastro">
          <h2>{selected ? 'Editar responsável' : 'Cadastrar responsável'}</h2>
          <OperationForm key={selected?.id ?? 'new'} action={saveGuardian.bind(null, slug)} label="Salvar cadastro">
            {selected && <input type="hidden" name="id" value={selected.id} />}
            <label>Nome completo <input className="field" name="display_name" defaultValue={selected?.display_name} required minLength={2} maxLength={100} /></label>
          </OperationForm>
          {selected && <AccountLink slug={slug} registry="guardians" recordId={selected.id} profileId={selected.profile_id} />}
          {selected && (
            <div className="clinic-related">
              <Link href={base}>Novo cadastro</Link>
              <h3>Vínculos com pacientes</h3>
              <ul className="clinic-list clinic-appointments">
                {linksByGuardian.get(selected.id)?.map(link => (
                  <li key={link.id}>
                    <details className="clinic-appointment-cancel">
                      <summary>{names.get(link.patient_id) ?? 'Paciente'} · {statuses[link.authorization_status as keyof typeof statuses]}</summary>
                      <OperationForm action={updateGuardianPatient.bind(null, slug)} label="Salvar vínculo">
                        <input type="hidden" name="id" value={link.id} />
                        <RelationshipFields relationship={link.relationship} status={link.authorization_status} />
                      </OperationForm>
                    </details>
                  </li>
                ))}
              </ul>
              {available.length > 0 && (
                <OperationForm action={addGuardianPatient.bind(null, slug)} label="Vincular paciente">
                  <input type="hidden" name="guardian_id" value={selected.id} />
                  <label>Paciente
                    <select className="field" name="patient_id" defaultValue="" required>
                      <option value="" disabled>Selecione</option>
                      {available.map(patient => <option key={patient.id} value={patient.id}>{patient.display_name}</option>)}
                    </select>
                  </label>
                  <RelationshipFields />
                </OperationForm>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  </>
}
