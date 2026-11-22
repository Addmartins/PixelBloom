'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { access, clinicPath, getClinic, getSession } from './tenancy'
import type { FormState } from './forms'
import { clinicSchedule, configuredTimezone, isCalendarDay, isClinicTimezone } from './schedule'
import { clinicLogoBucket, validateClinicLogo } from './clinic-logo'

const nameSchema = z.string().trim().min(2).max(100)
const uuidSchema = z.string().uuid()

function databaseError(code?: string): FormState {
  switch (code) {
    case '23505':
      return { error: 'Já existe um cadastro com esses dados.' }
    case '23P01':
      return { error: 'O profissional ou paciente já tem um atendimento neste horário.' }
    case '42501':
      return { error: 'Seu perfil não tem permissão para esta operação.' }
    case 'PBL01':
      return { error: 'O plano da clínica atingiu o limite de profissionais ativos.' }
    case 'PBA01':
      return { error: 'O horário está fora da disponibilidade do profissional ou a clínica está fechada nesta data.' }
    case '22023':
    case '23503':
    case '23514':
      return { error: 'Revise os dados informados e tente novamente.' }
    default:
      return { error: 'Não foi possível salvar. Tente novamente.' }
  }
}

export async function createOrganization(_state: FormState, form: FormData): Promise<FormState> {
  const name = nameSchema.safeParse(form.get('name'))
  const slug = z.string().trim().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).safeParse(form.get('slug'))
  if (!name.success || !slug.success) return { error: 'Informe o nome da clínica e um endereço com letras minúsculas, números ou hífens.' }
  const { db } = await getSession()
  const { error } = await db.rpc('create_organization', { p_name: name.data, p_slug: slug.data })
  if (error?.code === '23505') return { error: 'Este endereço já está em uso. Escolha outro.' }
  if (error) return databaseError(error.code)
  revalidatePath('/dashboard', 'layout')
  redirect(clinicPath(slug.data))
}

const durationSchema = z.coerce.number().int().min(5).max(480)
const optionalText = (max: number) => z.string().trim().max(max).default('')
const catalogSchemas = {
  patients: z.object({ display_name: nameSchema }),
  professionals: z.object({ display_name: nameSchema, registration_number: optionalText(60).transform(value => value || null) }),
  specialties: z.object({ name: nameSchema, description: optionalText(1000).transform(value => value || null) }),
  services: z.object({
    name: nameSchema,
    duration_minutes: durationSchema,
    description: optionalText(1000).transform(value => value || null),
    specialty_id: z.union([uuidSchema, z.literal('')]).optional().transform(value => value || null),
  }),
}

export type Registry = keyof typeof catalogSchemas

export async function saveRegistry(slug: string, registry: Registry, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  const allowed = registry === 'patients' ? access.patients(clinic.role) : access.catalog(clinic.role)
  if (!allowed) return databaseError('42501')

  const parsed = catalogSchemas[registry].safeParse(Object.fromEntries(form))
  const id = uuidSchema.optional().safeParse(form.get('id') ?? undefined)
  if (!parsed.success || !id.success) return { error: 'Revise os campos do cadastro.' }

  const result = id.data
    ? await db.from(registry).update(parsed.data).eq('organization_id', clinic.id).eq('id', id.data).select('id').maybeSingle()
    : await db.from(registry).insert({ ...parsed.data, organization_id: clinic.id }).select('id').single()
  if (result.error || !result.data) return databaseError(result.error?.code)
  revalidatePath(clinicPath(slug), 'layout')
  return { success: id.data ? 'Cadastro atualizado.' : 'Cadastro concluído.' }
}

export async function toggleRegistry(slug: string, registry: Registry, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  const allowed = registry === 'patients' ? access.patients(clinic.role) : access.catalog(clinic.role)
  if (!allowed) return databaseError('42501')
  const id = uuidSchema.safeParse(form.get('id'))
  const active = z.enum(['true', 'false']).safeParse(form.get('active'))
  if (!id.success || !active.success) return { error: 'Cadastro inválido.' }

  const desiredState = active.data === 'true'
  const { data, error } = await db.from(registry).update({ active: desiredState })
    .eq('organization_id', clinic.id).eq('id', id.data).select('id').maybeSingle()
  if (error || !data) return databaseError(error?.code)
  revalidatePath(clinicPath(slug), 'layout')
  return { success: desiredState ? 'Cadastro reativado.' : 'Cadastro desativado.' }
}

const appointmentSchema = z.object({
  patient: uuidSchema,
  professional: uuidSchema,
  service: uuidSchema,
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
})

export async function createAppointment(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.agenda(clinic.role)) return databaseError('42501')
  const result = appointmentSchema.safeParse(Object.fromEntries(form))
  if (!result.success) return { error: 'Escolha o paciente, o profissional, o serviço e o horário.' }
  const { patient, professional, service, start } = result.data
  const schedule = clinicSchedule(configuredTimezone(clinic.settings))
  const startAt = schedule.dateAt(start)
  if (!startAt) return { error: 'Informe um horário válido.' }
  const { error } = await db.rpc('create_appointment', {
    p_organization_id: clinic.id,
    p_patient_id: patient,
    p_professional_id: professional,
    p_service_id: service,
    p_start_at: startAt.toISOString(),
  })
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug), 'layout')
  return { success: `Atendimento agendado para ${schedule.dateTime(startAt.toISOString())}.` }
}

export async function cancelAppointment(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.agenda(clinic.role)) return databaseError('42501')
  const id = uuidSchema.safeParse(form.get('id'))
  const reason = z.string().trim().min(2).max(500).safeParse(form.get('reason'))
  if (!id.success || !reason.success) return { error: 'Informe o motivo do cancelamento.' }
  const { error } = await db.rpc('cancel_appointment', {
    p_organization_id: clinic.id,
    p_appointment_id: id.data,
    p_reason: reason.data,
  })
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug), 'layout')
  return { success: 'Agendamento cancelado.' }
}

export async function saveProfessionalPatient(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const parsed = z.object({ patient_id: uuidSchema, professional_id: uuidSchema }).safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Selecione um paciente e um profissional.' }
  const { error } = await db.from('professional_patients').insert({ ...parsed.data, organization_id: clinic.id })
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug, 'professionals'))
  return { success: 'Vínculo cadastrado.' }
}

export async function removeProfessionalPatient(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const id = uuidSchema.safeParse(form.get('id'))
  if (!id.success) return { error: 'Vínculo inválido.' }
  const { data, error } = await db.from('professional_patients').delete().eq('organization_id', clinic.id).eq('id', id.data)
    .select('id').maybeSingle()
  if (error || !data) return databaseError(error?.code)
  revalidatePath(clinicPath(slug, 'professionals'))
  return { success: 'Vínculo removido.' }
}

export async function saveGuardian(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const id = uuidSchema.optional().safeParse(form.get('id') ?? undefined)
  const name = nameSchema.safeParse(form.get('display_name'))
  if (!id.success || !name.success) return { error: 'Informe um nome válido.' }
  const record = { display_name: name.data }
  const { data, error } = id.data
    ? await db.from('guardians').update(record).eq('organization_id', clinic.id).eq('id', id.data).select('id').maybeSingle()
    : await db.from('guardians').insert({ ...record, organization_id: clinic.id }).select('id').single()
  if (error || !data) return databaseError(error?.code)
  revalidatePath(clinicPath(slug, 'guardians'))
  return { success: id.data ? 'Cadastro atualizado.' : 'Responsável cadastrado.' }
}

const guardianStatus = z.enum(['pending', 'authorized', 'revoked'])

export async function addGuardianPatient(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const parsed = z.object({
    guardian_id: uuidSchema,
    patient_id: uuidSchema,
    relationship: nameSchema,
    authorization_status: guardianStatus,
  }).safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Revise o paciente, o responsável e a relação informada.' }
  const { error } = await db.from('patient_guardians').insert({ ...parsed.data, organization_id: clinic.id })
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug, 'guardians'))
  return { success: 'Vínculo cadastrado.' }
}

export async function updateGuardianPatient(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const id = uuidSchema.safeParse(form.get('id'))
  const parsed = z.object({ relationship: nameSchema, authorization_status: guardianStatus }).safeParse(Object.fromEntries(form))
  if (!id.success || !parsed.success) return { error: 'Revise a relação e o estado da autorização.' }
  const { data, error } = await db.from('patient_guardians').update(parsed.data)
    .eq('organization_id', clinic.id).eq('id', id.data).select('id').maybeSingle()
  if (error || !data) return databaseError(error?.code)
  revalidatePath(clinicPath(slug, 'guardians'))
  return { success: 'Vínculo atualizado.' }
}

export type LinkRegistry = 'patients' | 'guardians' | 'professionals'

export async function linkAccount(slug: string, registry: LinkRegistry, recordId: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const selected = form.get('profile_id')
  const profile = selected === '' ? { success: true, data: null } as const : uuidSchema.safeParse(selected)
  if (!profile.success || !uuidSchema.safeParse(recordId).success) return { error: 'Selecione um membro válido.' }

  if (registry === 'patients') {
    const { error } = await db.rpc('link_patient_profile', {
      p_organization_id: clinic.id, p_patient_id: recordId, p_profile_id: profile.data,
    })
    if (error) return databaseError(error.code)
  } else {
    const { data, error } = await db.from(registry).update({ profile_id: profile.data })
      .eq('organization_id', clinic.id).eq('id', recordId).select('id').maybeSingle()
    if (error || !data) return databaseError(error?.code)
  }

  revalidatePath(clinicPath(slug, registry))
  return { success: profile.data ? 'Conta vinculada.' : 'Vínculo com a conta removido.' }
}

export async function rescheduleAppointment(slug: string, appointmentId: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.agenda(clinic.role)) return databaseError('42501')
  const start = appointmentSchema.shape.start.safeParse(form.get('start'))
  const startAt = start.success ? clinicSchedule(configuredTimezone(clinic.settings)).dateAt(start.data) : null
  if (!startAt || !start.success || !uuidSchema.safeParse(appointmentId).success) return { error: 'Informe um horário válido.' }
  const { error } = await db.rpc('reschedule_appointment', {
    p_organization_id: clinic.id, p_appointment_id: appointmentId, p_start_at: startAt.toISOString(),
  })
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug), 'layout')
  redirect(`${clinicPath(slug, 'agenda')}?day=${start.data.slice(0, 10)}`)
}

export async function confirmAppointment(slug: string, appointmentId: string): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.agenda(clinic.role)) return databaseError('42501')
  if (!uuidSchema.safeParse(appointmentId).success) return { error: 'Agendamento inválido.' }
  const { error } = await db.rpc('confirm_appointment', {
    p_organization_id: clinic.id, p_appointment_id: appointmentId,
  })
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug), 'layout')
  return { success: 'Atendimento confirmado.' }
}

export async function updateClinicName(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const name = nameSchema.safeParse(form.get('name'))
  if (!name.success) return { error: 'Informe um nome válido para a organização.' }
  const { data, error } = await db.from('organizations').update({ name: name.data })
    .eq('id', clinic.id).select('id').maybeSingle()
  if (error || !data) return databaseError(error?.code)
  revalidatePath('/dashboard', 'layout')
  return { success: 'Nome da organização atualizado.' }
}

export async function uploadClinicLogo(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const file = form.get('logo')
  const image = file instanceof File ? await validateClinicLogo(file) : null
  if (!(file instanceof File) || !image) return { error: 'Selecione uma imagem PNG, JPEG ou WebP de até 2 MiB.' }

  const path = `${clinic.id}/${crypto.randomUUID()}.${image.extension}`
  const bucket = db.storage.from(clinicLogoBucket)
  const upload = await bucket.upload(path, file, { contentType: image.contentType, upsert: false })
  if (upload.error) return { error: 'Não foi possível enviar o logotipo.' }

  const update = db.from('organizations').update({ logo_url: path }).eq('id', clinic.id)
  const { data, error } = await (clinic.logo_url ? update.eq('logo_url', clinic.logo_url) : update.is('logo_url', null))
    .select('id').maybeSingle()
  if (error || !data) {
    await bucket.remove([path])
    return { error: 'Não foi possível salvar o logotipo. Recarregue a página e tente novamente.' }
  }
  if (clinic.logo_url) await bucket.remove([clinic.logo_url])
  revalidatePath('/dashboard', 'layout')
  return { success: 'Logotipo atualizado.' }
}

export async function updateClinicTimezone(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const timezone = form.get('timezone')
  if (!isClinicTimezone(timezone)) return { error: 'Selecione um fuso horário disponível.' }
  const { error } = await db.rpc('update_organization_timezone', {
    p_organization_id: clinic.id, p_timezone: timezone,
  })
  if (error) return databaseError(error.code)
  revalidatePath('/dashboard', 'layout')
  return { success: 'Fuso horário atualizado.' }
}

const localClock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)

export async function saveAvailability(slug: string, professionalId: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const slot = z.object({
    weekday: z.coerce.number().int().min(0).max(6),
    start_time: localClock,
    end_time: localClock,
  }).safeParse(Object.fromEntries(form))
  if (!slot.success || !uuidSchema.safeParse(professionalId).success || slot.data.end_time <= slot.data.start_time) {
    return { error: 'Escolha o dia e um horário de término posterior ao início.' }
  }
  const { error } = await db.from('professional_availability').insert({
    ...slot.data, organization_id: clinic.id, professional_id: professionalId,
  })
  if (error?.code === '23P01') return { error: 'Este intervalo coincide com um horário cadastrado.' }
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug, 'professionals'))
  return { success: 'Horário cadastrado.' }
}

async function removeScheduleRule(slug: string, table: 'professional_availability' | 'organization_holidays', id: string) {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  if (!uuidSchema.safeParse(id).success) return { error: 'Cadastro inválido.' }
  const { data, error } = await db.from(table).delete().eq('organization_id', clinic.id).eq('id', id).select('id').maybeSingle()
  if (error || !data) return databaseError(error?.code)
  revalidatePath(clinicPath(slug, table === 'professional_availability' ? 'professionals' : 'configuracoes'))
  return { success: 'Horário atualizado.' }
}

export async function removeAvailability(slug: string, id: string): Promise<FormState> {
  return removeScheduleRule(slug, 'professional_availability', id)
}

export async function saveHoliday(slug: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const day = form.get('day')
  const name = nameSchema.safeParse(form.get('name'))
  if (!isCalendarDay(day) || !name.success) return { error: 'Informe uma data e um nome válidos.' }
  const { error } = await db.from('organization_holidays').insert({ organization_id: clinic.id, day, name: name.data })
  if (error?.code === '23505') return { error: 'Já existe um fechamento nesta data.' }
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug, 'configuracoes'))
  return { success: 'Fechamento cadastrado.' }
}

export async function removeHoliday(slug: string, id: string): Promise<FormState> {
  return removeScheduleRule(slug, 'organization_holidays', id)
}

export async function addProfessionalSpecialty(slug: string, professionalId: string, _state: FormState, form: FormData): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  const specialty = uuidSchema.safeParse(form.get('specialty_id'))
  if (!specialty.success || !uuidSchema.safeParse(professionalId).success) return { error: 'Selecione uma especialidade válida.' }
  const { error } = await db.from('professional_specialties').insert({
    organization_id: clinic.id, professional_id: professionalId, specialty_id: specialty.data,
  })
  if (error) return databaseError(error.code)
  revalidatePath(clinicPath(slug, 'professionals'))
  return { success: 'Especialidade vinculada.' }
}

export async function removeProfessionalSpecialty(slug: string, id: string): Promise<FormState> {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return databaseError('42501')
  if (!uuidSchema.safeParse(id).success) return { error: 'Vínculo inválido.' }
  const { data, error } = await db.from('professional_specialties').delete()
    .eq('organization_id', clinic.id).eq('id', id).select('id').maybeSingle()
  if (error || !data) return databaseError(error?.code)
  revalidatePath(clinicPath(slug, 'professionals'))
  return { success: 'Especialidade removida.' }
}
