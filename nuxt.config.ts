import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/better-auth', 'shadcn-nuxt', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    neonDatabaseUrl: '',
    neonDatabaseUrlUnpooled: '',
    betterAuthSecret: '',
    fedapaySecretKey: '',
    fedapayWebhookSecret: '',
    cloudinaryApiSecret: '',
    cloudinaryApiKey: '',
    whatsappAccessToken: '',
    emailApiKey: '',
    public: {
      siteName: 'Votre onglerie',
      siteUrl: '',
      locale: 'fr-BJ',
      timeZone: 'Africa/Porto-Novo',
      currency: 'XOF',
      salonPhone: '',
      salonWhatsApp: '',
      salonAddress: '',
      salonCity: '',
      salonEmail: '',
      salonInstagram: '',
      fedapayPublicKey: '',
      demoMode: true,
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr-BJ' },
      meta: [
        { name: 'theme-color', content: '#f5f0e9' },
        { name: 'color-scheme', content: 'light' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192.png', sizes: '192x192' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap', rel: 'stylesheet' },
      ],
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    manifest: {
      name: `${process.env.NUXT_PUBLIC_SITE_NAME || 'Studio manucure'} — Rendez-vous`,
      short_name: process.env.NUXT_PUBLIC_SITE_NAME || 'Manucure',
      description: 'Découvrez les prestations et préparez votre rendez-vous.',
      lang: 'fr-BJ',
      start_url: '/',
      display: 'standalone',
      background_color: '#f5f0e9',
      theme_color: '#6b2d45',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,woff2,svg,png,webp}'],
      navigateFallback: undefined,
      runtimeCaching: [
        {
          urlPattern: ({ request, url }) => request.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/admin/') && !url.pathname.startsWith('/mon-compte/') && /\.(?:js|css|woff2|svg|png|webp)$/.test(url.pathname),
          handler: 'CacheFirst',
          options: {
            cacheName: 'public-static-v1',
            expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/') || url.pathname.startsWith('/mon-compte/'),
          handler: 'NetworkOnly',
        },
      ],
    },
    devOptions: { enabled: false },
  },
  nitro: {
    preset: 'vercel',
  },
})
