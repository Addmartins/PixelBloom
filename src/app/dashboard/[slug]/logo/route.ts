import { clinicLogoBucket, logoContentTypes } from '@/features/operations/clinic-logo'
import { getClinic } from '@/features/operations/tenancy'

const cacheControl = 'private, no-store'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { db, clinic } = await getClinic(slug)
  const path = clinic.logo_url
  const extension = path?.split('.').at(-1)
  const contentType = extension && logoContentTypes[extension]
  if (!path || !contentType || !path.startsWith(`${clinic.id}/`)) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': cacheControl } })
  }
  const { data, error } = await db.storage.from(clinicLogoBucket).download(path)
  if (error || !data) return new Response(null, { status: 404, headers: { 'Cache-Control': cacheControl } })
  return new Response(data, {
    headers: {
      'Cache-Control': cacheControl,
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
