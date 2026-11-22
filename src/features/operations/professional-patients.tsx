import { removeProfessionalPatient, saveProfessionalPatient } from './actions'
import { OperationForm } from './forms'
import { getClinic } from './tenancy'

export async function ProfessionalPatients({ slug, professionalId }: { slug: string; professionalId: string }) {
  const { db, clinic } = await getClinic(slug)
  const [patients, links] = await Promise.all([
    db.from('patients').select('id,display_name,active').eq('organization_id', clinic.id).order('display_name'),
    db.from('professional_patients').select('id,patient_id').eq('organization_id', clinic.id).eq('professional_id', professionalId),
  ])
  if (patients.error || links.error) throw new Error('Não foi possível carregar os vínculos.')
  const names = new Map(patients.data.map(patient => [patient.id, patient.display_name]))
  const linked = new Set(links.data.map(link => link.patient_id))
  const available = patients.data.filter(patient => patient.active && !linked.has(patient.id))

  return (
    <section className="clinic-related">
      <h3>Pacientes vinculados</h3>
      {links.data.length > 0 ? (
        <ul className="clinic-list clinic-records">
          {links.data.map(link => (
            <li key={link.id}>
              <strong>{names.get(link.patient_id) ?? 'Paciente'}</strong>
              <OperationForm action={removeProfessionalPatient.bind(null, slug)} label="Remover vínculo" compact>
                <input type="hidden" name="id" value={link.id} />
              </OperationForm>
            </li>
          ))}
        </ul>
      ) : <p className="clinic-empty">Nenhum paciente vinculado a este profissional.</p>}
      {available.length > 0 && (
        <OperationForm action={saveProfessionalPatient.bind(null, slug)} label="Vincular paciente">
          <input type="hidden" name="professional_id" value={professionalId} />
          <label>Paciente
            <select className="field" name="patient_id" defaultValue="" required>
              <option value="" disabled>Selecione</option>
              {available.map(patient => <option key={patient.id} value={patient.id}>{patient.display_name}</option>)}
            </select>
          </label>
        </OperationForm>
      )}
    </section>
  )
}
