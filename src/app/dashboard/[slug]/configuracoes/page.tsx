import { notFound } from 'next/navigation'
import { ClinicLogo } from '@/features/operations/clinic-logo-image'
import { removeHoliday, saveHoliday, updateClinicName, updateClinicTimezone, uploadClinicLogo } from '@/features/operations/actions'
import { clinicTimezones, configuredTimezone, isClinicTimezone } from '@/features/operations/schedule'
import { OperationForm } from '@/features/operations/forms'
import { access, getClinic } from '@/features/operations/tenancy'

export default async function ClinicSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) notFound()
  const timezone = configuredTimezone(clinic.settings)
  const { data: holidays, error } = await db.from('organization_holidays').select('id,day,name')
    .eq('organization_id', clinic.id).order('day')
  if (error) throw new Error('Não foi possível carregar os fechamentos da clínica.')

  return (
    <>
      <header className="clinic-page-header"><h1>Configurações da clínica</h1></header>
      <section className="panel clinic-section">
        <h2>Organização</h2>
        <OperationForm action={updateClinicName.bind(null, slug)} label="Salvar configuração">
          <label>Nome da clínica
            <input className="field" name="name" defaultValue={clinic.name} required minLength={2} maxLength={100} autoComplete="organization" />
          </label>
        </OperationForm>
      </section>
      <section className="panel clinic-section clinic-settings-section">
        <h2>Horário da clínica</h2>
        <OperationForm action={updateClinicTimezone.bind(null, slug)} label="Salvar fuso horário">
          <label>Fuso horário
            <select className="field" name="timezone" defaultValue={timezone} required>
              {!isClinicTimezone(timezone) && <option disabled value={timezone}>{timezone}</option>}
              {Object.entries(clinicTimezones).map(([zone, city]) => <option key={zone} value={zone}>{city}</option>)}
            </select>
          </label>
        </OperationForm>
        <section className="clinic-related">
          <h3>Feriados e fechamentos</h3>
          {holidays.length > 0 ? (
            <ul className="clinic-list clinic-records">
              {holidays.map(holiday => (
                <li key={holiday.id}>
                  <span>{holiday.day.split('-').reverse().join('/')} · {holiday.name}</span>
                  <OperationForm action={removeHoliday.bind(null, slug, holiday.id)} label="Remover fechamento" compact />
                </li>
              ))}
            </ul>
          ) : <p className="clinic-empty">Nenhum fechamento cadastrado.</p>}
          <OperationForm action={saveHoliday.bind(null, slug)} label="Adicionar fechamento">
            <label>Nome <input className="field" name="name" required minLength={2} maxLength={100} /></label>
            <label>Data <input className="field" name="day" type="date" required /></label>
          </OperationForm>
        </section>
      </section>
      <section className="panel clinic-section clinic-settings-section">
        <h2>Logotipo</h2>
        {clinic.logo_url && <ClinicLogo slug={slug} path={clinic.logo_url} className="clinic-logo-preview" size={96} alt="Logotipo atual da clínica" />}
        <OperationForm action={uploadClinicLogo.bind(null, slug)} label="Salvar logotipo">
          <label>Arquivo da imagem
            <input className="field" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required aria-describedby="logo-help" />
            <small id="logo-help">PNG, JPEG ou WebP de até 2 MiB.</small>
          </label>
        </OperationForm>
      </section>
    </>
  )
}
