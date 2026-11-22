import Link from 'next/link'
import { linkAccount, type LinkRegistry } from './actions'
import { OperationForm } from './forms'
import { access, clinicPath, getClinic } from './tenancy'

type Member = { profile_id: string; display_name: string; role: string }

const roleByRegistry = {
  patients: 'patient',
  guardians: 'guardian',
  professionals: 'professional',
} as const

export async function AccountLink({ slug, registry, recordId, profileId }: {
  slug: string
  registry: LinkRegistry
  recordId: string
  profileId?: string | null
}) {
  const { db, clinic } = await getClinic(slug)
  if (!access.catalog(clinic.role)) return null
  const { data, error } = await db.rpc('list_relation_members', { p_organization_id: clinic.id })
  if (error) throw new Error('Não foi possível carregar as contas elegíveis.')
  const members = (data as Member[]).filter(member => member.role === roleByRegistry[registry])
  const currentlyAvailable = members.some(member => member.profile_id === profileId)

  return (
    <section className="clinic-related">
      <h3>Conta de acesso</h3>
      {!profileId && members.length === 0 ? (
        <p className="clinic-empty">Convide a pessoa em <Link href={clinicPath(slug, 'membros')}>Membros</Link>. Após o aceite, vincule a conta a este cadastro.</p>
      ) : (
        <OperationForm action={linkAccount.bind(null, slug, registry, recordId)} label="Salvar vínculo com a conta">
          <label>Conta vinculada
            <select className="field" name="profile_id" defaultValue={profileId ?? ''} key={profileId ?? ''}>
              <option value="">Sem conta vinculada</option>
              {profileId && !currentlyAvailable && <option disabled value={profileId}>Conta indisponível</option>}
              {members.map(member => <option key={member.profile_id} value={member.profile_id}>{member.display_name}</option>)}
            </select>
          </label>
        </OperationForm>
      )}
    </section>
  )
}
