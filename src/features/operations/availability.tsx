import { saveAvailability, removeAvailability } from './actions'
import { OperationForm } from './forms'
import { configuredTimezone, timezoneLabel } from './schedule'
import { getClinic } from './tenancy'

const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

export async function Availability({ slug, professionalId, editable = true }: { slug: string; professionalId: string; editable?: boolean }) {
  const { db, clinic } = await getClinic(slug)
  const { data, error } = await db.from('professional_availability').select('id,weekday,start_time,end_time')
    .eq('organization_id', clinic.id).eq('professional_id', professionalId).eq('active', true).order('weekday').order('start_time')
  if (error) throw new Error('Não foi possível carregar a disponibilidade.')
  return (
    <section className="clinic-related">
      <h3>Disponibilidade semanal</h3>
      <p>Horário local de {timezoneLabel(configuredTimezone(clinic.settings))}. Sem horários cadastrados, a agenda fica aberta.</p>
      {data.length > 0 && (
        <ul className="clinic-list clinic-records">
          {data.map(slot => (
            <li key={slot.id}>
              <span>{weekdays[slot.weekday]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</span>
              {editable && <OperationForm action={removeAvailability.bind(null, slug, slot.id)} label="Remover horário" compact />}
            </li>
          ))}
        </ul>
      )}
      {editable && <OperationForm action={saveAvailability.bind(null, slug, professionalId)} label="Adicionar horário">
        <label>Dia da semana
          <select className="field" name="weekday" defaultValue="1" required>
            {weekdays.map((name, day) => <option value={day} key={day}>{name}</option>)}
          </select>
        </label>
        <label>Início <input type="time" className="field" name="start_time" defaultValue="08:00" required /></label>
        <label>Término <input type="time" className="field" name="end_time" defaultValue="17:00" required /></label>
      </OperationForm>}
    </section>
  )
}
