# Déploiement, environnements et sauvegardes

## Environnements

Créer trois configurations isolées (développement, staging, production), chacune avec son propre projet/branche PostgreSQL Neon, ses URL pooled et directes, ses secrets Better Auth, ses clés/sandbox de paiement, ses webhooks et destinations de notification. Ne jamais partager les données clientes de production avec tests/e2e, ni réutiliser les secrets webhooks sandbox. La base Neon attachée à un environnement peut être partagée ; toute écriture de tests y modifie les mêmes données que l’application.

Nuxt/Nitro est construit avec le preset `vercel`; la construction ne doit ni faire de connexion Neon, ni créer un propriétaire, ni lire des credentials. Commande de build : `pnpm install --frozen-lockfile && pnpm build`. Fournir les secrets dans la configuration sécurisée Vercel, côté runtime. Renseigner `NUXT_PUBLIC_SITE_URL` seulement après validation du domaine HTTPS public. Garder `NUXT_PUBLIC_DEMO_MODE=true` jusqu’à la création d’un vrai salon et de données vérifiées.

## Schéma et déploiement

1. Restaurer la sauvegarde dans une base staging séparée et vérifier les migrations.
2. Générer une migration avec `pnpm db:generate`, relire SQL et vérifier qu’elle est compatible/déployable en ligne.
3. Exécuter `NEON_DATABASE_URL_UNPOOLED=... pnpm db:migrate` sur la base ciblée avant bascule de code. Ne pas ajouter de migration destructive non rétrocompatible dans le même déploiement.
4. Déployer et vérifier l’endpoint `/api/health`, le formulaire, les pages publiques, le login, l’origine et les clés de fournisseur; vérifier les journaux FedaPay/Meta séparément.
5. Ouvrir l’indexation uniquement après renseignements réels, examen légal, vraie origine et présence du sitemap.

`vercel.json` déclare la libération des retenues chaque minute, le traitement de la file toutes les cinq minutes et les rappels toutes les quinze minutes. Vercel impose des limites de fréquence selon l’offre ; confirmer que le plan choisi permet ces intervalles avant de déployer ce calendrier, sinon utiliser un scheduler autorisant ces fréquences sans réduire silencieusement le temps de retenue. Les crons doivent inclure la variable `CRON_SECRET` côté runtime et utilisent l’autorisation Bearer attendue par Vercel. Limiter les logs du fournisseur et ne pas logguer le corps/client/numéro complet.

## Branches et bascule

`main` représente la version stable publiée. `develop-mvp` intègre les fonctionnalités avant validation. `feature/<nom>` suit une fonctionnalité testée et `hotfix/<nom>` un correctif ciblé. Créer `product-v2` depuis un tag Git vérifié de `main`, mais toujours pointer vers une base et des comptes fournisseur V2 séparés. La branche ne sépare pas une base de données. Ne pas exécuter les tests/démos V2 sur la base de production.

## Sauvegarde et reprise

Activer les sauvegardes/restauration continues selon le plan Neon choisi et vérifier périodiquement une restauration staging. Les exports `pg_dump` doivent être cryptés, stockés hors du dépôt dans un emplacement avec rétention et contrôle d’accès, puis supprimés selon une politique définie par le salon. Ne jamais joindre des exports de clientes, numéros ou sauvegardes dans les commits. Pour une restauration, figer les écritures, restaurer dans une base distincte, vérifier les décomptes/états, changer explicitement le DSN ciblé, puis reprendre le trafic après vérification.

## Points qui exigent une configuration externe

Vercel, Neon, FedaPay, Cloudinary, Meta/WhatsApp et le fournisseur de mail n’ont pas été authentifiés depuis ce dépôt. Les valeurs/permissions/webhooks doivent être fournis et validés par l’exploitant avant activation ; ni publication ni intégration en direct ne sont présumées par ce guide.
