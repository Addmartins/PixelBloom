import Image from 'next/image'
import { clinicPath } from './tenancy'

export function ClinicLogo({ slug, path, className, size, alt = '' }: {
  slug: string
  path: string
  className: string
  size: number
  alt?: string
}) {
  const revision = path.split('/').at(-1)
  return <Image src={`${clinicPath(slug, 'logo')}?v=${encodeURIComponent(revision ?? '')}`} alt={alt} width={size} height={size} className={className} unoptimized />
}
