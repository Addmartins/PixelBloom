import { Catalog } from '@/features/operations/catalog'

export default async function CatalogPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const [{ slug }, { edit }] = await Promise.all([params, searchParams])
  return <Catalog slug={slug} registry="services" edit={typeof edit === 'string' ? edit : undefined} />
}
