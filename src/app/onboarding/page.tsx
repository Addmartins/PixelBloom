import Link from 'next/link'
import { Flower2, ArrowLeft } from 'lucide-react'
import { createOrganization } from '@/features/operations/actions'
import { OperationForm } from '@/features/operations/forms'
import { getClinics } from '@/features/operations/tenancy'
import { logout } from '@/features/auth/actions'
import '@/features/operations/operations.css'

export default async function OnboardingPage() {
  const clinics = await getClinics()
  return (
    <main className="clinic-onboarding" id="main-content">
      <div className="panel clinic-onboarding-panel">
        <div className="clinic-brand"><Flower2 aria-hidden="true" /> PixelBloom</div>
        <h1>Crie sua organização</h1>
        <p>Cadastre a clínica para começar. Você pode configurar os serviços e a equipe depois.</p>
        <OperationForm action={createOrganization} label="Criar organização">
          <label>
            Nome da clínica
            <input className="field" name="name" required minLength={2} maxLength={100} autoComplete="organization" />
          </label>
          <label>
            Endereço da organização
            <input className="field" name="slug" required minLength={3} maxLength={64} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" aria-describedby="slug-help" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            <small id="slug-help">Use letras minúsculas, números e hífens. Por exemplo, clinica-bloom.</small>
          </label>
        </OperationForm>
        {clinics.length > 0 && <Link className="clinic-return" href="/dashboard"><ArrowLeft size={16} aria-hidden="true" /> Minhas organizações</Link>}
        <div className="clinic-account">
          <Link href="/conta/perfil">Meu perfil</Link>
          <Link href="/conta/convite">Aceitar convite</Link>
          <form action={logout}><button type="submit" className="button-secondary">Sair</button></form>
        </div>
      </div>
    </main>
  )
}
