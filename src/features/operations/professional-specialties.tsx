import { addProfessionalSpecialty, removeProfessionalSpecialty } from './actions'
import { OperationForm } from './forms'
import { getClinic } from './tenancy'

export async function ProfessionalSpecialties({ slug, professionalId }: { slug: string; professionalId: string }) {
  const { db, clinic } = await getClinic(slug)
  const [specialties, links] = await Promise.all([
    db.from('specialties').select('id,name,active').eq('organization_id', clinic.id).order('name'),
    db.from('professional_specialties').select('id,specialty_id').eq('organization_id', clinic.id).eq('professional_id', professionalId),
  ])
  if (specialties.error || links.error) throw new Error('Não foi possível carregar as especialidades do profissional.')
  const names = new Map(specialties.data.map(specialty => [specialty.id, specialty.name]))
  const linked = new Set(links.data.map(link => link.specialty_id))
  const available = specialties.data.filter(specialty => specialty.active && !linked.has(specialty.id))

  return (
    <section className="clinic-related">
      <h3>Especialidades vinculadas</h3>
      {links.data.length > 0 ? (
        <ul className="clinic-list clinic-records">
          {links.data.map(link => (
            <li key={link.id}>
              <span>{names.get(link.specialty_id) ?? 'Especialidade'}</span>
              <OperationForm action={removeProfessionalSpecialty.bind(null, slug, link.id)} label="Remover especialidade" compact />
            </li>
          ))}
        </ul>
      ) : <p className="clinic-empty">Nenhuma especialidade vinculada.</p>}
      {available.length > 0 && (
        <OperationForm action={addProfessionalSpecialty.bind(null, slug, professionalId)} label="Vincular especialidade">
          <label>Especialidade
            <select name="specialty_id" className="field" required defaultValue="">
              <option disabled value="">Selecione</option>
              {available.map(specialty => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}
            </select>
          </label>
        </OperationForm>
      )}
    </section>
  )
}
