import Link from 'next/link'
import { ArrowRight, CalendarCheck, CalendarClock, CalendarDays, ClipboardList, Stethoscope, Users } from 'lucide-react'
import { getExperience } from '@/features/experience/access'
import { getGuardianAppointments } from '@/features/operations/guardian-agenda'
import { clinicPath } from '@/features/operations/tenancy'
import { clinicSchedule, configuredTimezone, shiftDay } from '@/features/operations/schedule'

const clinicMetrics = [
  { id: 'patients', label: 'Pacientes ativos', icon: Users },
  { id: 'professionals', label: 'Profissionais ativos', icon: Stethoscope },
  { id: 'services', label: 'Serviços ativos', icon: ClipboardList },
] as const

const receptionMetrics = [
  { id: 'today', label: 'Atendimentos hoje', icon: CalendarDays },
  { id: 'scheduled', label: 'Aguardam confirmação', icon: CalendarClock },
  { id: 'confirmed', label: 'Confirmados hoje', icon: CalendarCheck },
] as const

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { db, clinic, features } = await getExperience(slug)
  const administrative = ['owner', 'admin', 'manager'].includes(clinic.role)
  const reception = clinic.role === 'reception'
  const personal = clinic.role === 'patient' || clinic.role === 'professional'
  const schedule = clinicSchedule(configuredTimezone(clinic.settings))
  const today = schedule.day()
  const metrics = reception ? receptionMetrics : clinicMetrics

  const [appointments, counts] = await Promise.all([
    clinic.role === 'guardian'
      ? getGuardianAppointments(slug).then(items => ({ data: items.filter(item => ['scheduled', 'confirmed'].includes(item.status)).slice(0, 5), error: null }))
      : db.from('appointments').select('id,start_at,status').eq('organization_id', clinic.id)
        .gte('start_at', new Date().toISOString()).in('status', ['scheduled', 'confirmed'])
        .order('start_at').limit(5),
    reception
      ? Promise.all(receptionMetrics.map(metric => {
        const query = db.from('appointments').select('id', { count: 'exact', head: true })
          .eq('organization_id', clinic.id).gte('start_at', schedule.dayStart(today))
          .lt('start_at', schedule.dayStart(shiftDay(today, 1)))
        return metric.id === 'today' ? query.neq('status', 'canceled') : query.eq('status', metric.id)
      }))
      : administrative
        ? Promise.all(clinicMetrics.map(metric =>
          db.from(metric.id).select('id', { count: 'exact', head: true }).eq('organization_id', clinic.id).eq('active', true)))
        : [],
  ])
  if (appointments.error || counts.some(result => result.error)) throw new Error('Não foi possível carregar a visão geral.')

  const agendaTitle = personal ? 'Minha agenda' : clinic.role === 'guardian' ? 'Agenda dos pacientes vinculados' : 'Agenda da clínica'
  const pixelLink = clinic.role === 'patient' && features?.pixel_world_enabled
  const activityLink = features?.activities && ['professional', 'guardian', 'patient'].includes(clinic.role)

  return (
    <>
      <header className="clinic-page-header"><h1>Visão geral</h1><p>{clinic.name}</p></header>
      <section className="clinic-hero">
        <div>
          <h2>{agendaTitle}</h2>
          <p>Consulte os horários dos próximos atendimentos e acompanhe mudanças na agenda.</p>
          <div className="clinic-account">
            <Link className="button" href={clinicPath(slug, 'agenda')}>Abrir agenda <ArrowRight size={17} aria-hidden="true" /></Link>
            {pixelLink && <Link className="button-secondary" href={`/kids/${slug}`}>Abrir PixelBloom Kids</Link>}
            {clinic.role === 'guardian' && features?.pixel_world && <Link className="button-secondary" href={clinicPath(slug, 'familia')}>Área da família</Link>}
            {activityLink && <Link className="button-secondary" href={clinicPath(slug, 'atividades')}>Atividades</Link>}
          </div>
        </div>
        <div aria-hidden="true" className="clinic-pixel-bloom"><i /><i /><i /></div>
      </section>
      {(administrative || reception) && (
        <dl className="clinic-metrics">
          {metrics.map(({ id, label, icon: Icon }, index) => (
            <div className="panel clinic-metric" key={id}>
              <dt><Icon aria-hidden="true" size={19} />{label}</dt>
              <dd>{counts[index]?.count ?? 0}</dd>
            </div>
          ))}
        </dl>
      )}
      <section className="panel clinic-section">
        <div className="clinic-section-heading"><h2><CalendarDays size={20} aria-hidden="true" /> Próximos atendimentos</h2></div>
        {appointments.data.length === 0 ? <p className="clinic-empty">Nenhum atendimento futuro disponível.</p> : (
          <ul className="clinic-list clinic-records">
            {appointments.data.map(item => (
              <li key={item.id}>
                <Link href={`${clinicPath(slug, 'agenda')}?day=${schedule.day(new Date(item.start_at))}`}>
                  <time dateTime={item.start_at}>{schedule.dateTime(item.start_at)}</time>
                </Link>
                <span className="clinic-status">{item.status === 'confirmed' ? 'Confirmado' : 'Agendado'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
