import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, Flower2, LogOut, MailOpen, Plus, UserRound } from 'lucide-react'
import { getExperience } from '@/features/experience/access'
import { clinicPath, roleLabels } from '@/features/operations/tenancy'
import { logout } from '@/features/auth/actions'
import { ClinicLogo } from '@/features/operations/clinic-logo-image'
import { ClinicNav } from '@/features/operations/navigation'
import '@/features/operations/operations.css'

export default async function ClinicLayout({ children, params }: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { clinic, clinics, features } = await getExperience(slug)
  const items = [
    { segment: '', label: 'Visão geral' },
    { segment: 'agenda', label: 'Agenda' },
  ]
  if (!['guardian', 'patient'].includes(clinic.role)) {
    items.push({ segment: 'patients', label: 'Pacientes' })
  }
  if (['owner', 'admin', 'manager', 'reception'].includes(clinic.role)) {
    items.push({ segment: 'professionals', label: 'Profissionais' }, { segment: 'services', label: 'Serviços' }, { segment: 'specialties', label: 'Especialidades' })
  }
  if (['owner', 'admin', 'reception', 'guardian'].includes(clinic.role)) items.push({ segment: 'guardians', label: clinic.role === 'guardian' ? 'Pacientes vinculados' : 'Responsáveis' })
  if (['owner', 'admin'].includes(clinic.role)) items.push({ segment: 'membros', label: 'Membros' })
  if (features?.activities && !['reception', 'manager'].includes(clinic.role)) items.push({ segment: 'atividades', label: 'Atividades' })
  if (features?.announcements) items.push({ segment: 'avisos', label: 'Avisos' })
  if (features?.pixel_world && clinic.role === 'guardian') items.push({ segment: 'familia', label: 'Área da família' })
  if (features?.pixel_world && ['owner', 'admin', 'patient'].includes(clinic.role)) items.push({ segment: 'pixel-world', label: clinic.role === 'patient' ? 'PixelBloom Kids' : 'Pixel World' })
  if (['owner', 'admin'].includes(clinic.role)) items.push({ segment: 'configuracoes', label: 'Configurações' })
  if (clinic.role === 'owner') items.push({ segment: 'plano', label: 'Plano' })
  return (
    <div className="clinic-shell">
      <aside className="clinic-sidebar">
        <Link href={clinicPath(slug)} className="clinic-brand"><Flower2 aria-hidden="true" size={25} /> PixelBloom</Link>
        <details className="clinic-switcher">
          <summary>
            {clinic.logo_url
              ? <ClinicLogo slug={slug} path={clinic.logo_url} className="clinic-monogram clinic-logo" size={36} />
              : <span className="clinic-monogram" aria-hidden="true">{clinic.name.slice(0, 1).toUpperCase()}</span>}
            <span><strong>{clinic.name}</strong><small>{roleLabels[clinic.role]}</small></span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <ul className="clinic-list">
            {clinics.filter(item => item.id !== clinic.id).map(item => (
              <li key={item.id}><Link href={clinicPath(item.slug)}>{item.name}</Link></li>
            ))}
            <li><Link href="/conta/convite"><MailOpen size={16} aria-hidden="true" /> Aceitar convite</Link></li>
            <li><Link href="/onboarding"><Plus size={16} aria-hidden="true" /> Criar organização</Link></li>
          </ul>
        </details>
        <ClinicNav items={items} base={clinicPath(slug)} />
        <div className="clinic-account">
          <Link className="button-secondary" href="/conta/perfil"><UserRound size={16} aria-hidden="true" /> Meu perfil</Link>
          <form action={logout}><button type="submit" className="button-secondary"><LogOut size={16} aria-hidden="true" /> Sair</button></form>
        </div>
      </aside>
      <main id="main-content" key={slug} className="clinic-main">{children}</main>
    </div>
  )
}
