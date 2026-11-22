import { getClinic } from './tenancy'

type GuardianAppointment = {
  id: string
  patient_id: string
  start_at: string
  end_at: string
  status: string
  service_id?: never
  professional_id?: never
}

export async function getGuardianAppointments(slug: string): Promise<GuardianAppointment[]> {
  const { db, clinic } = await getClinic(slug)
  if (clinic.role !== 'guardian') return []
  const { data, error } = await db.rpc('list_guardian_appointments', { p_organization_id: clinic.id })
  if (error) throw new Error('Não foi possível carregar a agenda dos pacientes vinculados.')
  return data as GuardianAppointment[]
}
