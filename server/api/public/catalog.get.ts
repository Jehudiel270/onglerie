import { and, asc, desc, eq } from 'drizzle-orm'
import { env } from 'node:process'
import { createError, defineEventHandler, setHeader } from 'h3'
import { demoCategories, demoPortfolio, demoServices } from '../../data/demo'
import { getDatabase, hasNeonDatabase } from '../../db/client'
import { categories, portfolioItemTags, portfolioItems, portfolioTags, salons, services } from '../../db/schema'
import type { PortfolioCard, PublicCatalog, ServiceCard } from '~~/shared/types/catalog'
import { getSalonBookingSettings } from '../../services/salon-settings'

export default defineEventHandler(async (event): Promise<PublicCatalog> => {
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  const demoMode = env.NUXT_PUBLIC_DEMO_MODE !== 'false'
  if (!hasNeonDatabase()) {
    if (!demoMode) throw createError({ statusCode: 503, statusMessage: 'Le catalogue nécessite la configuration Neon du salon.' })
    return { demo: true, salonName: 'Votre onglerie', services: demoServices, serviceCategories: ['Soins', 'Pose', 'Nail art'], portfolio: demoPortfolio, portfolioCategories: demoCategories }
  }
  const db = getDatabase()
  const [salon] = await db.select().from(salons).where(eq(salons.status, 'active')).orderBy(asc(salons.createdAt)).limit(1)
  if (!salon) return { demo: false, salonName: env.NUXT_PUBLIC_SITE_NAME || 'Votre onglerie', services: [], serviceCategories: [], portfolio: [], portfolioCategories: [] }
  const bookingSettings=await getSalonBookingSettings(salon.id)
  const serviceRows = await db.select({ service: services, categoryName: categories.name, categorySlug: categories.slug })
    .from(services).leftJoin(categories, and(eq(services.categoryId, categories.id), eq(categories.salonId, salon.id)))
    .where(and(eq(services.salonId, salon.id), eq(services.active, true))).orderBy(asc(services.position), asc(services.name))
  const serviceCards: ServiceCard[] = serviceRows.map(({ service, categoryName, categorySlug }) => ({
    id: service.id, slug: service.slug, name: service.name, description: service.description,
    ...(service.details ? { details: service.details } : {}), category: categoryName ?? 'Prestations', categorySlug: categorySlug ?? 'prestations',
    priceXof: service.priceXof, durationMinutes: service.durationMinutes, preparationMinutes: service.preparationMinutes, depositXof: service.depositXof||Math.round(service.priceXof*bookingSettings.depositPercent/100),
    ...(service.imageUrl ? { imageUrl: service.imageUrl } : {}), ...(service.conditions ? { conditions: service.conditions } : {}), featured: service.featured,
  }))
  const categoryRows = await db.select({ name: categories.name, kind: categories.kind }).from(categories)
    .where(and(eq(categories.salonId, salon.id), eq(categories.active, true))).orderBy(asc(categories.position), asc(categories.name))
  const portfolioRows = await db.select({ item: portfolioItems, categoryName: categories.name, serviceSlug: services.slug })
    .from(portfolioItems)
    .leftJoin(categories, and(eq(portfolioItems.categoryId, categories.id), eq(categories.salonId, salon.id)))
    .leftJoin(services, and(eq(portfolioItems.serviceId, services.id), eq(services.salonId, salon.id)))
    .where(and(eq(portfolioItems.salonId, salon.id), eq(portfolioItems.published, true)))
    .orderBy(desc(portfolioItems.featured), desc(portfolioItems.createdAt))
  const tagRows = portfolioRows.length ? await db.select({ itemId: portfolioItemTags.portfolioItemId, name: portfolioTags.name })
    .from(portfolioItemTags).innerJoin(portfolioTags, and(eq(portfolioItemTags.tagId, portfolioTags.id), eq(portfolioTags.salonId, salon.id))) : []
  const tagsByItem = new Map<string, string[]>()
  for (const tag of tagRows) tagsByItem.set(tag.itemId, [...(tagsByItem.get(tag.itemId) ?? []), tag.name])
  const portfolioCards: PortfolioCard[] = portfolioRows.map(({ item, categoryName, serviceSlug }) => ({
    id: item.id, slug: item.slug, title: item.title, description: item.description ?? '', category: categoryName ?? 'Inspirations',
    style: item.style ?? '', color: item.color ?? '', shape: item.shape ?? '', length: item.length ?? '', technique: item.technique ?? '',
    tags: tagsByItem.get(item.id) ?? [], imageUrls: item.imageUrls, ...(serviceSlug ? { serviceSlug } : {}), featured: item.featured, trend: item.trend,
  }))
  return { demo: false, salonName: salon.name, services: serviceCards, serviceCategories: categoryRows.filter((item) => item.kind === 'service').map((item) => item.name), portfolio: portfolioCards, portfolioCategories: categoryRows.filter((item) => item.kind === 'portfolio').map((item) => item.name) }
})
