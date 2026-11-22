import Link from 'next/link'
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react'
import { cancelAppointment, confirmAppointment, createAppointment, rescheduleAppointment } from '@/features/operations/actions'
import { getGuardianAppointments } from '@/features/operations/guardian-agenda'
import { Availability } from '@/features/operations/availability'
import { OperationForm } from '@/features/operations/forms'
import { clinicSchedule, configuredTimezone, shiftDay, timezoneLabel } from '@/features/operations/schedule'
import { access, clinicPath, getClinic } from '@/features/operations/tenancy'

const statusLabels: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  canceled: 'Cancelado',
}

type Option = { id: string; label: string; active: boolean }

function SelectField({ name, label, options }: {
  name: string
  label: string
  options: Option[]
}) {
  return (
    <label>{label}
      <select className="field" name={name} defaultValue="" required>
        <option value="" disabled>Selecione</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  )
}

export default async function AgendaPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ day?: string | string[] }>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const { db, clinic } = await getClinic(slug)
  const timezone = configuredTimezone(clinic.settings)
  const schedule = clinicSchedule(timezone)
  const day = schedule.resolveDay(query.day)
  const canManage = access.agenda(clinic.role)
  const isGuardian = clinic.role === 'guardian'
  const [appointments, patients, professionals, services] = await Promise.all([
    isGuardian
      ? getGuardianAppointments(slug).then(items => ({ data: items.filter(item => schedule.day(new Date(item.start_at)) === day), error: null }))
      : db.from('appointments').select('id,patient_id,professional_id,service_id,start_at,end_at,status')
        .eq('organization_id', clinic.id).gte('start_at', schedule.dayStart(day))
        .lt('start_at', schedule.dayStart(shiftDay(day, 1))).order('start_at'),
    db.from('patients').select('id,display_name,active').eq('organization_id', clinic.id).order('display_name'),
    db.from('professionals').select('id,display_name,active').eq('organization_id', clinic.id).order('display_name'),
    db.from('services').select('id,name,active').eq('organization_id', clinic.id).order('name'),
  ])
  if (appointments.error || patients.error || professionals.error || services.error) throw new Error('Não foi possível carregar a agenda.')
  const patientOptions = patients.data.map(item => ({ id: item.id, label: item.display_name, active: item.active }))
  const professionalOptions = professionals.data.map(item => ({ id: item.id, label: item.display_name, active: item.active }))
  const serviceOptions = services.data.map(item => ({ id: item.id, label: item.name, active: item.active }))
  const options = [patientOptions, professionalOptions, serviceOptions].map(items => items.filter(item => item.active))
  const prerequisites = options.every(items => items.length > 0)
  const agenda = clinicPath(slug, 'agenda')
  const ownProfessional = clinic.role === 'professional' ? professionalOptions[0] : undefined

  return (
    <>
      <header className="clinic-page-header"><h1>Agenda</h1><p>{isGuardian ? 'Próximos atendimentos dos pacientes vinculados. ' : ''}Horário local de {timezoneLabel(timezone)}</p></header>
      <div className={canManage ? 'clinic-columns' : undefined}>
        <section className="panel clinic-section">
          <div className="clinic-section-heading"><h2><CalendarDays size={20} aria-hidden="true" /> Atendimentos do dia</h2></div>
          <form className="clinic-date-picker" method="get" action={agenda}>
            <Link href={`${agenda}?day=${shiftDay(day, -1)}`} className="button-secondary" aria-label="Dia anterior"><ArrowLeft size={17} aria-hidden="true" /></Link>
            <label>Data <input key={day} name="day" className="field" type="date" defaultValue={day} required /></label>
            <button className="button-secondary" type="submit">Ver dia</button>
            <Link href={`${agenda}?day=${shiftDay(day, 1)}`} className="button-secondary" aria-label="Próximo dia"><ArrowRight size={17} aria-hidden="true" /></Link>
          </form>
          {appointments.data.length === 0 ? <p className="clinic-empty">Nenhum agendamento nesta data.</p> : (
            <ul className="clinic-list clinic-appointments">
              {appointments.data.map(item => {
                const patient = patientOptions.find(option => option.id === item.patient_id)?.label
                const professional = professionalOptions.find(option => option.id === item.professional_id)?.label
                const service = serviceOptions.find(option => option.id === item.service_id)?.label
                return (
                  <li key={item.id}>
                    <div className="clinic-appointment-row">
                      <div>
                        <strong>{schedule.time(item.start_at)} – {schedule.time(item.end_at)} · {service ?? 'Atendimento'}</strong>
                        <small>{[patient, professional].filter(Boolean).join(' · ')}</small>
                      </div>
                      <span className="clinic-status">{statusLabels[item.status] ?? item.status}</span>
                    </div>
                    {canManage && ['scheduled', 'confirmed'].includes(item.status) && (
                      <div className="clinic-appointment-actions">
                        {item.status === 'scheduled' && (
                          <OperationForm action={confirmAppointment.bind(null, slug, item.id)} label="Confirmar atendimento" compact />
                        )}
                        <details className="clinic-appointment-cancel">
                          <summary>Reagendar</summary>
                          <OperationForm action={rescheduleAppointment.bind(null, slug, item.id)} label="Salvar novo horário">
                            <label>Nova data e hora <input className="field" type="datetime-local" name="start" defaultValue={`${day}T${schedule.time(item.start_at)}`} required /></label>
                          </OperationForm>
                        </details>
                        <details className="clinic-appointment-cancel">
                          <summary>Cancelar atendimento</summary>
                          <OperationForm action={cancelAppointment.bind(null, slug)} label="Confirmar cancelamento">
                            <input type="hidden" name="id" value={item.id} />
                            <label>Motivo do cancelamento <input className="field" name="reason" required minLength={2} maxLength={500} /></label>
                          </OperationForm>
                        </details>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {ownProfessional && <Availability slug={slug} professionalId={ownProfessional.id} editable={false} />}
        </section>
        {canManage && (
          <section className="panel clinic-section">
            <h2>Novo agendamento</h2>
            {prerequisites ? (
              <OperationForm key={day} action={createAppointment.bind(null, slug)} label="Agendar atendimento">
                <SelectField name="patient" label="Paciente" options={options[0]} />
                <SelectField name="professional" label="Profissional" options={options[1]} />
                <SelectField name="service" label="Serviço" options={options[2]} />
                <label>Data e hora <input className="field" type="datetime-local" name="start" defaultValue={`${day}T09:00`} required /></label>
              </OperationForm>
            ) : (
              <div className="clinic-empty">
                <p>Para agendar, a clínica precisa ter um paciente, um profissional e um serviço ativos.</p>
                <ul className="clinic-list">
                  {options[0].length === 0 && <li><Link href={clinicPath(slug, 'patients')}>Ver pacientes</Link></li>}
                  {options[1].length === 0 && <li><Link href={clinicPath(slug, 'professionals')}>Ver profissionais</Link></li>}
                  {options[2].length === 0 && <li><Link href={clinicPath(slug, 'services')}>Ver serviços</Link></li>}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}
