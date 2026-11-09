# Plateforme de réservation d’onglerie — MVP

Application Nuxt SSR en français pour un salon pilote au Bénin. Elle réunit une vitrine éditoriale interactive avec scène WebGL Three.js des couches d’une pose et progression GSAP ScrollTrigger, un catalogue, un portfolio de références, un parcours de réservation, un espace cliente et un tableau de bord privé. Le thème, le style des boutons, les icônes, le verre dépoli et la scène sont réglables par salon. Le nom, les coordonnées, les services, les photos et les règles du salon ne sont pas présumés : les exemples visibles en mode démo sont explicitement étiquetés.

## Technologies

Nuxt 4 / Vue 3 / TypeScript strict, Tailwind CSS 4 (`@tailwindcss/vite`), shadcn-vue via `shadcn-nuxt`, `@lucide/vue`, Three.js, GSAP ScrollTrigger, Nitro, Better Auth, PostgreSQL Neon, Drizzle ORM/Kit, Zod, FedaPay SDK, Cloudinary, Vitest et Playwright. L’instance Neon PostgreSQL est externe au MySQL géré par la plateforme. Les connexions/pools et migrations doivent rester propres à chaque environnement.

## Démarrage local

Prérequis : Node compatible Nuxt 4, pnpm (version épinglée par `package.json`) et un shell POSIX.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

Sans secrets Neon, l’application publique reste en **mode démonstration** : elle montre des prestations/prix d’exemple et des images éditoriales générées clairement étiquetées. Les réservations et formulaires qui exigent une persistance répondent qu’ils ne sont pas configurés ; aucune réservation, aucun paiement et aucune écriture fictive ne sont confirmés. Pour activer les données réelles, configurez une base PostgreSQL Neon isolée de développement dans `NEON_DATABASE_URL`, la connexion directe dans `NEON_DATABASE_URL_UNPOOLED`, puis `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PUBLIC_SITE_URL`, `NUXT_PUBLIC_SITE_URL` et les clés fournisseurs nécessaires. `PUBLIC_SITE_URL` sert au callback FedaPay, `BETTER_AUTH_URL` à l’authentification et `NUXT_PUBLIC_SITE_URL` aux canoniques/social ; toutes trois doivent pointer vers le domaine réel adéquat en production. Mettre `NUXT_PUBLIC_DEMO_MODE=false` seulement après configuration du salon et de ses règles.

## Base et premier compte propriétaire

```bash
pnpm db:generate
pnpm db:migrate
```

`drizzle.config.ts` prend l’URL directe `NEON_DATABASE_URL_UNPOOLED` pour les migrations. Le serveur utilise l’URL de runtime. Aucun `seed` de fausses réservations n’est lancé dans Neon partagé. Les exemples restent en mémoire côté serveur lorsque le mode démo est actif.

Pour créer le premier propriétaire après une migration réussie, définir pour une seule exécution `ALLOW_OWNER_BOOTSTRAP=YES_CREATE_FIRST_OWNER`, `BOOTSTRAP_OWNER_NAME`, `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_PASSWORD` (au moins 14 caractères, avec minuscule, majuscule et chiffre), `BOOTSTRAP_SALON_NAME`, `BOOTSTRAP_SALON_SLUG`, et `BOOTSTRAP_SALON_CITY`, puis exécuter `pnpm bootstrap:owner`. Le script refuse la création si un propriétaire existe, n’affiche pas le mot de passe et ne modifie pas un compte déjà rattaché à un salon. Retirer immédiatement toutes ces variables après l’exécution et vérifier les accès avant d’activer le catalogue public.

Voir [`docs/database.md`](docs/database.md) pour le choix du driver, les transactions et la séparation des bases.

## Fournisseurs externes

- **FedaPay** : configurer les clés et le secret de webhook du même environnement dans `FEDAPAY_ENV`, `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`; installer le callback fourni par l’application dans FedaPay. Tester d’abord sur le sandbox. La confirmation dépend du webhook authentifié, d’une relecture fournisseur, de l’état, du montant XOF et de la devise. La redirection ne prouve jamais un paiement.
- **Cloudinary** : `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET`. L’API de signature est privée et les médias utilisent les uploads signés ; le secret ne va jamais au navigateur.
- **WhatsApp Business Cloud** : fournir les variables du compte Meta, du numéro, du token API et des modèles approuvés. L’action `wa.me` est un lien manuel, jamais une preuve d’envoi.
- **E-mail** : aucun service fournisseur n’est supposé. Le connecteur attend `EMAIL_API_URL`, une clé et un expéditeur valides. Les événements sont mis en file dans Neon et peuvent être réessayés sans doublon.

La récupération de réservation invitée utilise une référence et le numéro déjà enregistrés ; elle envoie un OTP à six chiffres uniquement sur un canal configuré, valable dix minutes et à usage unique. Elle n’indique pas si la référence existe, limite les essais et renouvelle le jeton d’accès invité après succès. Voir [`docs/guest-booking-recovery.md`](docs/guest-booking-recovery.md). Pour WhatsApp, le nom du modèle approuvé de récupération est `WHATSAPP_TEMPLATE_BOOKING_RECOVERY`.

Les noms de variables, clés publiques et limites sont consignés dans [`.env.example`](.env.example). La procédure pour ajouter les valeurs dans le gestionnaire sécurisé du dashboard du projet est dans [`docs/secure-configuration.md`](docs/secure-configuration.md). Ne pas mettre de secrets réels dans Git, les journaux, l’administration du salon ou l’application cliente.

## Vérifications

```bash
pnpm typecheck
pnpm typecheck:scripts
pnpm test
pnpm test:e2e
pnpm build
```

Les suites de tests ne doivent pas écrire ou supprimer des données sur une base partagée. Les scénarios d’intégration Neon/FedaPay exigent des projets de test, clés sandbox et numéros/destinataires dédiés, pas la production.

## Vercel

Le preset Nitro `vercel` est préparé. Importer le dépôt canonique dans Vercel, sélectionner le runtime Node/Nuxt, utiliser `pnpm install --frozen-lockfile` et `pnpm build`, puis définir les variables server-only, `PUBLIC_SITE_URL`, `BETTER_AUTH_URL` et `NUXT_PUBLIC_SITE_URL` avec les URL HTTPS réellement validées. Les secrets sont lus au runtime, pas durant le build. Créer des projets/environnements Neon et des comptes/certificats fournisseurs distincts pour Preview, staging et production. Ne jamais promouvoir une URL ou un secret sandbox vers la production par défaut. Consulter [`docs/deployment.md`](docs/deployment.md) avant une publication.

Les endpoints planifiés sont protégés par `CRON_SECRET`. Une mise en ligne sans clés/configuration de fournisseur n’active pas les rappels, le paiement ou l’envoi automatique. Laisser l’indexation fermée (mode démo), configurer l’origine HTTPS et les informations réelles du salon, puis vérifier `robots.txt`/`sitemap.xml` avant d’ouvrir le site aux moteurs.

## Arborescence principale

- `app/pages`, `app/layouts`, `app/components`, `app/composables`, `app/assets`: routes SSR, navigation, scènes 3D, gestionnaires et styles.
- `server/api`: endpoints REST publics, cliente, owner/admin, paiement et cron.
- `server/services`: règles métier réservations/disponibilités, salons, paiements et notifications.
- `server/db`: schéma Drizzle et client Neon paresseux ; migrations dans `server/db/migrations/`.
- `shared/schemas`, `shared/types`, `shared/constants`: contrats Zod, types et règles partagés.
- `tests/unit`, `tests/e2e`: tests isolés et navigateur.
- `docs`: décisions base/intégrations, déploiement, politique de démo et roadmap V2.

## Fonctionnement honnête des références

Les visuels fournis sous `public/images/` sont des compositions éditoriales générées, pas le résultat réel d’une cliente, du lieu ou d’une professionnelle. Le bouton de référence relie une réalisation réellement publiée à une demande. La scène 3D explique une composition illustrative et n’effectue pas d’essayage photo/AR/IA ; voir [`docs/v2-roadmap.md`](docs/v2-roadmap.md) et [`docs/scroll-3d-research.md`](docs/scroll-3d-research.md).
