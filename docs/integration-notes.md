# Notes techniques vérifiées — 5 novembre 2026

Ces notes conservent les sources officielles consultées pour éviter de confondre les capacités des adaptateurs. Les versions npm ont été interrogées avec `pnpm view <paquet> version` le 5 novembre 2026 ; elles ne garantissent pas qu’un fournisseur soit configuré.

## Frontend

Nuxt 4.6.4, Vue 3.5.44 et Tailwind CSS 4.3.4 sont les versions publiées interrogées. Le guide Tailwind pour Nuxt configure `@tailwindcss/vite` en plugin Vite et importe `tailwindcss` dans un CSS global. L’application suit cette configuration. `@vite-pwa/nuxt` 1.1.1 expose le manifest et Workbox ; le service worker ne met en cache que les fichiers publics statiques, jamais les routes API, compte ou administration. Le package historique `lucide-vue-next` est marqué deprecated ; son successeur officiel interrogé est `@lucide/vue` 1.68.0.

Sources : [Tailwind CSS — installation Nuxt](https://tailwindcss.com/docs/installation/framework-guides/nuxt) ; [Nuxt — module @vite-pwa/nuxt](https://nuxt.com/modules/vite-pwa-nuxt) ; [Lucide Vue](https://lucide.dev/guide/packages/lucide-vue-next).

## Authentification

Better Auth 1.7.17 et `@nuxtjs/better-auth` 0.3.14 sont les versions interrogées. L’intégration Nuxt monte les handlers auth sous `/api/auth` et vérifie une session serveur avec `auth.api.getSession({ headers: event.headers })`. L’adaptateur Drizzle accepte le fournisseur PostgreSQL `pg`. Le module fournit l’auto-import serveur `serverAuth(event)` ; l’application l’utilise et vérifie séparément le rôle et l’adhésion du salon, car une simple session n’autorise pas le rôle propriétaire. En aperçu HTTPS intégré, les cookies doivent être `SameSite=None; Secure`; en HTTP local les attributs restent distincts.

Sources : [Better Auth — intégration Nuxt](https://better-auth.com/docs/integrations/nuxt) ; [Better Auth — adaptateur Drizzle](https://better-auth.com/docs/adapters/drizzle) ; [Better Auth — options cookie](https://better-auth.com/docs/concepts/cookies).

## Neon / Drizzle

Drizzle ORM 0.45.4, Drizzle Kit 0.31.11 et `@neondatabase/serverless` 1.2.0 sont les versions interrogées. La documentation Drizzle/Neon distingue les requêtes HTTP simples des transactions interactives et prescrit le transport WebSocket pour Pool/sessions transactionnelles. L’application utilise le Pool Neon côté runtime et garde une URL non poolée pour `drizzle-kit migrate`, afin que PgBouncer ne prenne pas en charge les migrations.

Sources : [Drizzle ORM — démarrage Neon](https://orm.drizzle.team/docs/get-started/neon-new) ; [Neon — connexion Drizzle](https://neon.com/docs/guides/drizzle).

## FedaPay

`fedapay` 1.2.5 a été interrogé. Son SDK Node expose `Transaction.create`, `Transaction.retrieve`, `Transaction.generateToken`, `Webhook.constructEvent` et `WebhookSignature`. La création de transaction se fait avec un montant, une devise ISO XOF, un `callback_url`, un client, puis un token qui renvoie une URL d’hébergement. `Webhook.constructEvent` vérifie le corps HTTP brut, l’en-tête `X-FEDAPAY-SIGNATURE`, l’horodatage et la signature HMAC à l’aide du secret propre au webhook. La transaction est ensuite relue chez FedaPay avant rapprochement : statut approuvé/transféré, montant et devise doivent correspondre aux données enregistrées. Un retour navigateur n’est jamais une preuve de paiement. Les secrets webhook sandbox et production doivent être distincts.

Sources : [FedaPay — webhooks et événements](https://docs.fedapay.com/en/integration-api/webhooks) ; [FedaPay — SDK Node.js](https://github.com/fedapay/fedapay-node) ; [FedaPay — transactions](https://docs.fedapay.com/paiements/transactions).

## Cloudinary et notifications

`cloudinary` 2.11.0 est la version interrogée. La documentation distingue les uploads signés côté serveur ; le secret API ne doit pas apparaître dans le navigateur. WhatsApp Business Cloud nécessite un token, un identifiant de numéro et des modèles approuvés adaptés aux notifications hors fenêtre de conversation ; `wa.me` ouvre uniquement une conversation manuelle et ne prouve pas une livraison automatique. Aucun fournisseur d’e-mail n’est supposé : l’adaptateur doit recevoir une URL/API fournie par l’exploitant.

Sources : [Cloudinary — upload Node.js](https://cloudinary.com/documentation/node_image_and_video_upload) ; [Meta — Cloud API WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api/).
