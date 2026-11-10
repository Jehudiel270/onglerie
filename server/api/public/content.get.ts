import { asc, eq } from 'drizzle-orm'
import { env } from 'node:process'
import { createError, defineEventHandler, setHeader } from 'h3'
import { demoSiteContent } from '../../data/demo'
import { getDatabase, hasNeonDatabase } from '../../db/client'
import { salons, siteContent } from '../../db/schema'
import { DEFAULT_SALON_APPEARANCE } from '~~/shared/constants/appearance'
import { getSalonAppearanceSettings } from '../../services/salon-settings'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  if (!hasNeonDatabase()) {
    if (env.NUXT_PUBLIC_DEMO_MODE === 'false') throw createError({ statusCode: 503, statusMessage: 'Le contenu du salon nécessite Neon.' })
    return { ...demoSiteContent, phone: '', whatsapp: '', email: '', address: '', city: '', instagram: '', openingHours: [], faq: [], heroImage: '/images/editorial-hero.webp', appearance: { ...DEFAULT_SALON_APPEARANCE } }
  }
  const db = getDatabase()
  const [salon] = await db.select().from(salons).where(eq(salons.status, 'active')).orderBy(asc(salons.createdAt)).limit(1)
  if (!salon) return { siteName: env.NUXT_PUBLIC_SITE_NAME || 'Votre onglerie', demo: false, configured: false, faq: [], openingHours: [], appearance: { ...DEFAULT_SALON_APPEARANCE } }
  const records = await db.select().from(siteContent).where(eq(siteContent.salonId, salon.id))
  const appearance = await getSalonAppearanceSettings(salon.id)
  const values = Object.fromEntries(records.map((record) => [record.contentKey, record.content])) as Record<string, Record<string, unknown>>
  const hero = values.hero ?? {}
  const about = values.about ?? {}
  const contacts = values.contact ?? {}
  return {
    siteName: salon.name, demo: false, configured: true,
    headline: typeof hero.headline === 'string' ? hero.headline : 'La beauté des mains, pensée pour vous.',
    intro: typeof hero.intro === 'string' ? hero.intro : '', heroImage: typeof hero.image === 'string' ? hero.image : '',
    about: typeof about.intro === 'string' ? about.intro : '', story: typeof about.story === 'string' ? about.story : '',
    values: Array.isArray(about.values) ? about.values : [], phone: salon.phone ?? '', whatsapp: salon.whatsapp ?? '', email: salon.email ?? '',
    address: salon.address ?? '', city: salon.city ?? '', instagram: salon.instagram ?? String(contacts.instagram ?? ''),
    openingHours: Array.isArray(values.hours?.items) ? values.hours.items : [],
    faq: Array.isArray(values.faq?.items) ? values.faq.items : [],
    featuredSlugs: Array.isArray(values.home?.featuredServiceSlugs) ? values.home.featuredServiceSlugs : [], appearance,
  }
})
