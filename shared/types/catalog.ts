export type ServiceCard = {
  id: string
  slug: string
  name: string
  description: string
  details?: string
  category: string
  categorySlug: string
  priceXof: number
  durationMinutes: number
  preparationMinutes?: number
  depositXof: number
  imageUrl?: string
  conditions?: string
  featured: boolean
  demo?: boolean
}

export type PortfolioCard = {
  id: string
  slug: string
  title: string
  description: string
  category: string
  style: string
  color: string
  shape: string
  length: string
  technique: string
  tags: string[]
  imageUrls: string[]
  serviceSlug?: string
  featured: boolean
  trend: boolean
  demo?: boolean
}

export type PublicCatalog = {
  demo: boolean
  salonName: string
  services: ServiceCard[]
  serviceCategories: string[]
  portfolio: PortfolioCard[]
  portfolioCategories: string[]
}

export type AvailabilitySlot = {
  startsAt: string
  endsAt: string
  staffId: string | null
  staffName: string | null
}
