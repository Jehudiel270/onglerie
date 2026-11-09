import type { PortfolioCard, ServiceCard } from '~~/shared/types/catalog'

export const demoServices: ServiceCard[] = [
  {
    id: 'demo-service-manicure', slug: 'manucure-soignee', name: 'Manucure soignée',
    description: 'Un soin essentiel et une finition nette, pensée pour votre style.',
    details: 'Exemple éditorial à remplacer par la fiche réelle du salon.', category: 'Soins', categorySlug: 'soins',
    priceXof: 8000, durationMinutes: 45, depositXof: 2000, imageUrl: '/images/inspiration-french.webp',
    conditions: 'Durée et tarif d’exemple ; à confirmer par le salon.', featured: true, demo: true,
  },
  {
    id: 'demo-service-gel', slug: 'pose-gel', name: 'Pose gel',
    description: 'Une pose structurée pour une silhouette élégante et durable.',
    details: 'Exemple éditorial à remplacer par la fiche réelle du salon.', category: 'Pose', categorySlug: 'pose',
    priceXof: 18000, durationMinutes: 90, depositXof: 5000, imageUrl: '/images/inspiration-chrome.webp',
    conditions: 'Durée et tarif d’exemple ; à confirmer par le salon.', featured: true, demo: true,
  },
  {
    id: 'demo-service-art', slug: 'nail-art-sur-mesure', name: 'Nail art sur mesure',
    description: 'Un détail graphique ou lumineux, imaginé autour de vos envies.',
    details: 'Exemple éditorial à remplacer par la fiche réelle du salon.', category: 'Nail art', categorySlug: 'nail-art',
    priceXof: 4000, durationMinutes: 30, depositXof: 2000, imageUrl: '/images/inspiration-chrome.webp',
    conditions: 'Tarif d’exemple ; le prix réel dépendra du modèle choisi.', featured: false, demo: true,
  },
]

export const demoPortfolio: PortfolioCard[] = [
  {
    id: 'demo-inspiration-french', slug: 'micro-french', title: 'Micro French',
    description: 'Une ligne ivoire fine sur une base nude.', category: 'French', style: 'Minimaliste',
    color: 'Nude & ivoire', shape: 'Amande courte', length: 'Courte', technique: 'Gel',
    tags: ['minimaliste', 'french', 'nude'], imageUrls: ['/images/inspiration-french.webp'],
    serviceSlug: 'manucure-soignee', featured: true, trend: false, demo: true,
  },
  {
    id: 'demo-inspiration-chrome', slug: 'chrome-prune', title: 'Chrome prune',
    description: 'Un reflet magnétique aux nuances prune et bronze.', category: 'Chrome', style: 'Cat eye',
    color: 'Prune & bronze', shape: 'Amande', length: 'Moyenne', technique: 'Gel cat eye',
    tags: ['chrome', 'cat-eye', 'soirée'], imageUrls: ['/images/inspiration-chrome.webp'],
    serviceSlug: 'nail-art-sur-mesure', featured: true, trend: true, demo: true,
  },
]

export const demoCategories = ['French', 'Baby Boomer', 'Chrome', 'Cat Eye', 'Nail Art', 'Minimaliste', 'Acrylique', 'Gel', 'Ongles naturels']

export const demoSiteContent = {
  salonName: 'Votre onglerie',
  headline: 'La beauté des mains, pensée pour vous.',
  intro: 'Découvrez les prestations, explorez les styles et préparez votre rendez-vous en quelques étapes.',
  about: 'Cet espace de présentation sera personnalisé avec l’histoire, les valeurs et les informations vérifiées du salon.',
  values: ['Une écoute attentive', 'Des détails soignés', 'Un rendez-vous préparé avec vous'],
  demo: true,
}
