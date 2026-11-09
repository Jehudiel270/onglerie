# Architecture applicative

## Découpage

Le monolithe Nuxt garde les pages SSR et endpoints Nitro dans un seul dépôt, mais sépare les domaines métier. `app/pages` contient les routes publiques, cliente et admin ; `app/layouts` isole les interfaces publique et privée ; `app/components` rassemble la scène WebGL Three.js synchronisée par GSAP ScrollTrigger, les cartes, la navigation et les outils CMS. Les composables gèrent l’origine publique, l’apparence et l’interface Nuxt. `server/api` regroupe les contrats REST, `server/services` porte les règles de réservation, les créneaux, l’auth, la récupération invitée, les transactions, le paiement et la file de notifications. `server/db` contient le schéma Drizzle/PostgreSQL et son client paresseux. `shared/` partage schémas Zod, types et règles XOF/fuseau.

## Contexte multi-salon

Les entités métier tenant-owned portent un `salonId` avec clé étrangère ; les lignes d’association et historiques sont atteintes au travers d’une entité parent préalablement limitée au salon. Les endpoints d’administration sensibles exigent une adhésion active et le rôle `owner` ou `manager`. Le rôle `staff` n’accède pas aux listes globales de clientes, paiements ou rendez-vous tant qu’un portail à périmètre `staff_id` n’existe pas. Les filtres salon sont répétés dans les opérations de lecture/écriture, même si l’identifiant d’une ligne vient du navigateur. L’extension de plateforme repose sur salons/memberships et ne crée pas une marketplace.

Les valeurs monétaires sont des entiers XOF. Les instants sont conservés en UTC avec affichage/planning `Africa/Porto-Novo`. Les prix/durées sont photographiés dans `appointment_services` lors de la demande, pour préserver l’historique malgré la modification d’une fiche.

## Réservation

Le serveur recalcule prix, dépôt, durée et technicienne à partir des IDs actifs. Il valide le délai minimum/horizon, horaires, pauses, durée, exceptions et état de disponibilité. Dans la transaction PostgreSQL, un verrou advisory par salon/clé d’idempotence évite un double envoi et un verrou par professionnelle/jour sérialise les créneaux qui se chevauchent. Le client de transactions Neon est utilisé pour que ces locks et requêtes de suivi partagent une transaction serveur. La réservation avec acompte crée une retenue temporaire ; une lecture externe de prix ou le retour navigateur n’ont pas autorité pour confirmer.

Les identifiants invités sont aléatoires, seul leur hash est stocké, et une expiration limite l’accès. Une cliente connectée ne voit que les réservations liées à son profil. La récupération invitée exige la référence et le téléphone déjà associés au rendez-vous ; un OTP de dix minutes, protégé par HMAC avec le secret serveur et limité à cinq essais, est consommé une seule fois puis remplace le jeton invité.

## Paiement et notifications

Une tentative FedaPay est créée/consignée côté serveur. L’URL d’hébergement est remise au client, mais le statut revient à « en attente » jusqu’à la réception d’un webhook signé et au rapprochement serveur montant/devise/référence. `payment_webhook_events` et les contraintes d’unicité/outbox protègent du retraitement.

Les messages sont écrits en outbox transactionnelle ; une tâche protégée réclame une lease, enregistre statut/erreur/tentatives, puis réessaie avec temporisation. Les connecteurs WhatsApp/e-mail ne sont actifs qu’avec leurs secrets/templates vérifiés.

## Confidentialité

Le catalogue et les contenus publics peuvent être cachés brièvement. Les sessions, données clientes, pages compte/admin, réponses de réservation, paiement et upload restent privées/no-store ; Workbox ne met en cache que les ressources statiques publiques. L’indexation du mode de démonstration est bloquée ; canonical/sitemap exigent une véritable origine HTTPS configurée. Les pages juridiques sont des brouillons à compléter/valider et les images démo sont identifiées.

Les requêtes sont validées par Zod côté serveur. Le limiteur de démo est local à l’instance ; avec Neon configuré, les buckets sont hachés et sérialisés transactionnellement pour couvrir les instances serverless. Les logs d’audit couvrent les opérations administratives sensibles. Les montants reçus sont séparés du total dû : le tableau de bord ne compte que les paiements rapprochés.
