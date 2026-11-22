import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'owner' | 'admin' | 'manager' | 'reception' | 'professional' | 'guardian' | 'patient'

export const roleLabels: Record<Role, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gestor',
  reception: 'Recepção',
  professional: 'Profissional',
  guardian: 'Responsável',
  patient: 'Paciente',
}

export const access = {
  catalog: (role: Role) => ['owner', 'admin'].includes(role),
  patients: (role: Role) => ['owner', 'admin', 'reception'].includes(role),
  agenda: (role: Role) => ['owner', 'admin', 'manager', 'reception'].includes(role),
}

type Organization = { id: string; name: string; slug: string; status: string; logo_url: string | null; settings: unknown }
type Clinic = Organization & { role: Role }

export const getSession = cache(async () => {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')
  return { db, user }
})

export const getClinics = cache(async (): Promise<Clinic[]> => {
  const { db, user } = await getSession()
  const [memberships, organizations] = await Promise.all([
    db.from('organization_memberships').select('organization_id,role').eq('profile_id', user.id).eq('status', 'active'),
    db.from('organizations').select('id,name,slug,status,logo_url,settings').order('name'),
  ])
  if (memberships.error || organizations.error) throw new Error('Não foi possível carregar as clínicas.')
  const roles = new Map(memberships.data.map(row => [row.organization_id, row.role as Role]))
  return organizations.data.flatMap(organization => {
    const role = roles.get(organization.id)
    return role && organization.status === 'active' ? [{ ...organization, role }] : []
  })
})

export const getClinic = cache(async (slug: string) => {
  const [{ db }, clinics] = await Promise.all([getSession(), getClinics()])
  const clinic = clinics.find(organization => organization.slug === slug)
  if (!clinic) notFound()
  return { db, clinic, clinics }
})

export const clinicPath = (slug: string, page = '') => `/dashboard/${slug}${page ? `/${page}` : ''}`
