import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Building2, Flower2, Plus } from 'lucide-react'
import { clinicPath, getClinics, roleLabels } from '@/features/operations/tenancy'
import { parseLoginPortal } from '@/features/auth/login-access'
import { logout } from '@/features/auth/actions'
import '@/features/operations/operations.css'

export default async function DashboardEntry({ searchParams }: { searchParams: Promise<{ acesso?: string }> }) {
  const [memberships, query] = await Promise.all([getClinics(), searchParams])
  const portal = parseLoginPortal(query.acesso)
  const clinics = memberships.filter(clinic => {
    if (!portal) return true
    const familyRole = clinic.role === 'patient' || clinic.role === 'guardian'
    return portal === 'familia' ? familyRole : !familyRole
  })
  const canCreate = portal !== 'familia' && (clinics.length > 0 || memberships.length === 0)
  if (clinics.length === 0 && canCreate) redirect('/onboarding')
  if (clinics.length === 1) redirect(clinicPath(clinics[0].slug))
  return (
    <main className="clinic-onboarding" id="main-content">
      <div className="panel clinic-onboarding-panel">
        <div className="clinic-brand"><Flower2 aria-hidden="true" /> PixelBloom</div>
        <h1>{portal === 'familia' ? 'Minhas clínicas' : 'Minhas organizações'}</h1>
        {clinics.length === 0 && (
          <p>{portal === 'familia'
            ? 'Peça à clínica um convite ou o vínculo da sua conta como paciente ou responsável.'
            : 'Sua conta não tem vínculo com uma equipe de clínica.'}</p>
        )}
        {clinics.length > 0 && <ul className="clinic-list">
          {clinics.map(clinic => (
            <li key={clinic.id}>
              <Link href={clinicPath(clinic.slug)} className="clinic-organization-link">
                <Building2 size={20} aria-hidden="true" />
                <span><strong>{clinic.name}</strong><small>{roleLabels[clinic.role]}</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>}
        {canCreate && <Link className="button-secondary" href="/onboarding"><Plus size={16} aria-hidden="true" /> Criar organização</Link>}
        {portal && <Link className="button-secondary" href={`/dashboard?acesso=${portal === 'familia' ? 'corporativo' : 'familia'}`}>
          {portal === 'familia' ? 'Ir para o acesso corporativo' : 'Ir para pacientes e responsáveis'}
        </Link>}
        <div className="clinic-account">
          <Link href="/conta/perfil">Meu perfil</Link>
          <Link href="/conta/convite">Aceitar convite</Link>
          <form action={logout}><button type="submit" className="button-secondary">Sair</button></form>
        </div>
      </div>
    </main>
  )
}
