# Base de données et transactions

L’application utilise Neon PostgreSQL et Drizzle. Le gestionnaire hébergé provisionne aussi une base MySQL de projet ; cette base n’est pas compatible avec le schéma PostgreSQL et n’est pas utilisée par les domaines métier. Le runtime lit `NEON_DATABASE_URL` (endpoint Neon poolé côté application) et `NEON_DATABASE_URL_UNPOOLED` (connexion directe pour Drizzle Kit). Ces noms distincts évitent de confondre la chaîne MySQL plateforme `DATABASE_URL` avec Neon.

Le brief exige des opérations transactionnelles pour éviter deux rendez-vous sur un même créneau. Le driver Neon HTTP convient aux requêtes simples mais ne prend pas en charge les transactions interactives. Le client de l’application s’appuie donc sur `@neondatabase/serverless` avec le transport WebSocket via `Pool` et Drizzle `neon-serverless`. La réservation verrouille le couple salon/professionnelle/date dans une transaction, vérifie les chevauchements, écrit la retenue et les snapshots de prix/durée, puis libère les retenues échues. `drizzle-kit migrate` utilise une connexion directe, pas une URL PgBouncer.

## Modèles

Le schéma contient les tables Better Auth (`user`, `session`, `account`, `verification`) et les domaines métier `salons`, `salon_memberships`, `categories`, `services`, `staff`, `staff_services`, `staff_schedules`, `schedule_exceptions`, `customers`, `portfolio_items`, `portfolio_tags`, `portfolio_item_tags`, `appointments`, `appointment_services`, `appointment_status_history`, `guest_recovery_challenges`, `customer_appointment_requests`, `payments`, `payment_webhook_events`, `salon_settings`, `site_content`, `contact_messages`, `notification_outbox`, `notification_logs`, `audit_logs` et `api_rate_limits`. Les OTP sont protégés par un HMAC utilisant `BETTER_AUTH_SECRET`, jamais par un hash non-clé à faible entropie.

Toutes les données monétaires sont des entiers XOF. Les entités tenant-owned portent `salon_id` ; les associations/historiques sont lues et écrites à partir d’un parent préalablement limité au salon. Les recherches administratives sont toujours limitées à l’adhésion salon de la session. Les rendez-vous conservent des instantanés des prestations commandées pour protéger l’historique si le catalogue évolue.

## Mise en service

1. Créer un projet/une branche Neon distincte pour le développement et pour la production.
2. Configurer `NEON_DATABASE_URL` avec le endpoint poolé et `NEON_DATABASE_URL_UNPOOLED` avec la chaîne directe ; ne pas utiliser la valeur MySQL `DATABASE_URL` de la plateforme.
3. Exécuter `pnpm db:generate`, examiner et versionner les migrations, puis `pnpm db:migrate`.
4. Il n’existe pas de commande de seed de base dans cette MVP. Les données présentées hors Neon sont explicitement en mémoire et marquées comme démonstration ; ne pas créer de réservations fictives dans une base partagée.
5. Créer le compte propriétaire via `pnpm bootstrap:owner` après configuration de la base et du secret Better Auth.

Une URL Neon poolée a été partagée dans la conversation, mais elle n’a pas été ajoutée au projet ni testée. L’URL directe/non-poolée et la branche cible ne sont pas encore confirmées ; aucune migration, connexion ou écriture Neon n’a donc été exécutée. Ne pas poursuivre tant que l’environnement et le DSN direct ne sont pas fournis via le canal sécurisé du projet.

## Références techniques

- [Drizzle ORM — démarrage Neon](https://orm.drizzle.team/docs/get-started/neon-new) — choix du transport HTTP/WebSocket et transactions.
- [Neon — connecter Drizzle](https://neon.com/docs/guides/drizzle) — URL poolée au runtime et URL directe pour les migrations.
- [Better Auth — adaptateur Drizzle](https://better-auth.com/docs/adapters/drizzle) — configuration du fournisseur PostgreSQL et génération des tables d’authentification.
