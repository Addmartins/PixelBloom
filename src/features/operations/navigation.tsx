'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, ClipboardList, Flower, Megaphone, NotebookPen, Settings, Tags, CreditCard, LayoutGrid, Stethoscope, UserRoundCheck, UserRoundCog, Users, HeartHandshake, type LucideIcon } from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  '': LayoutGrid,
  agenda: CalendarDays,
  patients: Users,
  professionals: Stethoscope,
  services: ClipboardList,
  specialties: Tags,
  guardians: UserRoundCheck,
  familia: HeartHandshake,
  membros: UserRoundCog,
  plano: CreditCard,
  configuracoes: Settings,
  atividades: NotebookPen,
  avisos: Megaphone,
  'pixel-world': Flower,
}

export function ClinicNav({ items, base }: {
  items: { segment: string; label: string }[]
  base: string
}) {
  const pathname = usePathname()
  return (
    <nav aria-label="Navegação da organização" className="clinic-nav">
      {items.map(({ segment, label }) => {
        const Icon = icons[segment]
        const href = segment ? `${base}/${segment}` : base
        const current = pathname === href
        return <Link key={href} href={href} aria-current={current ? 'page' : undefined}><Icon aria-hidden="true" size={19} />{label}</Link>
      })}
    </nav>
  )
}
