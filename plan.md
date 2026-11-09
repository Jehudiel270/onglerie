# Plan — MVP complète pour une onglerie au Bénin

## Périmètre et décisions

Le produit visé est une application commerciale multi-module pour un salon pilote : site public indexable, catalogue, portfolio, réservation réellement persistée, espace cliente facultatif, admin privé et documentation. La marque, les horaires, tarifs, coordonnées et photos réelles restent configurables. Aucun témoignage, résultat, certification ou établissement précis ne sera inventé. Les données d’exemple seront explicitement étiquetées.

La plateforme Manus a provisionné une base gérée MySQL, alors que le brief impose **Neon PostgreSQL** et Drizzle. MySQL n’est pas substituable à PostgreSQL pour les contraintes transactionnelles demandées. La couche de données utilise les variables distinctes `NEON_DATABASE_URL` (Pool WebSocket runtime) et `NEON_DATABASE_URL_UNPOOLED` (migrations Drizzle directes) ; la chaîne MySQL `DATABASE_URL` de la plateforme reste inutilisée. Les secrets/fournisseurs externes sont lus uniquement côté serveur. Sans chaîne Neon et clés fournisseurs, le site public et les contenus de démonstration explicitement étiquetés restent visibles, mais les opérations qui exigent une persistance ou un paiement réel répondent avec un état de configuration manquante, jamais avec un faux succès.

La version historique du package `lucide-vue-next` est marquée dépréciée dans le registre consulté ; le projet utilise son successeur officiel `@lucide/vue` (mêmes icônes Vue Lucide), plutôt que d’introduire une dépendance signalée comme obsolète.

La première passe livre les routes majeures, le modèle de données, les modules métier et les contrats d’API. Les intégrations FedaPay, Cloudinary, Better Auth, e-mail/WhatsApp seront implémentées derrière des adaptateurs et activées uniquement avec leurs variables réelles. FedaPay ne confirmera jamais une réservation sur le retour navigateur. La politique de réservation conservera temporairement un créneau et libérera les retenues expirées ; l’exclusion concurrente devra être faite en transaction PostgreSQL et décrite/testée.

## Structure cible

- `app/pages/` : pages SSR publiques, compte cliente, administration.
- `app/components/` : navigation, sections d’accueil, cartes, formulaires, calendrier, composants admin, scène WebGL Three.js et décor flottant.
- `app/composables/` : état local du parcours, disponibilité, filtres et apparence visiteuse.
- `app/assets/css/` : tokens et styles Tailwind.
- `server/api/` : endpoints REST par domaine, validation Zod et contrôle de session/role.
- `server/services/` : règles métier de réservation, paiements, notifications et contenu.
- `server/repositories/` : accès Drizzle au périmètre salon.
- `server/db/` : schémas, migrations Drizzle et client PostgreSQL paresseux ; aucune commande de seed n’est actuellement livrée.
- `shared/` : types, constantes, validateurs partagés.
- `public/` : manifeste, route-manifest WebDev et images éditoriales non documentaires.
- `docs/` : architecture, installation, base, paiement, notifications, déploiement, sauvegarde et roadmap V2.

## Design choisi

Pistes envisagées (probabilités faibles, alternatives de style) : éditorial beauté afro-luxe (0,07) ; minimalisme botanique ouest-africain (0,05) ; atelier chrome futuriste (0,06). Direction retenue : **éditorial beauté afro-luxe**, cohérente avec la palette et le positionnement premium du brief.

- **Mouvement** : éditorial beauté contemporain, entre magazine de mode et artisanat de précision.
- **Principes** : composition asymétrique ; matière et lumière avant décoration ; hiérarchie lisible ; aucun contenu fictif présenté comme preuve.
- **Couleurs** : ivoire chaud pour l’air et l’accueil ; brun encre pour la lecture ; rose poudré pour le soin ; bordeaux profond comme accent propriétaire, pour la précision et la distinction, jamais en saturation sur tout l’écran.
- **Layout** : hero décentré avec texte en colonne et visuel occupant le côté opposé ; rubans de données et numéros de section ; rail de navigation compact. Les listes de services et l’admin restent lisibles et adaptées au mobile.
- **Signatures** : motif monogramme fin inspiré d’un ongle amande ; filet bordeaux vertical ; objet nail-art en couches flottantes.
- **Interaction** : progression claire, gestes tactiles, CTA sans ambiguïté, navigation clavier ; l’objet 3D réagit doucement au pointeur et permet de décomposer visuellement les couches d’une pose. Ce modèle est une présentation esthétique, pas un essayage AR.
- **Animation** : entrées sobres au défilement, transitions courtes et respectueuses de `prefers-reduced-motion`; aucune animation ne bloque une action.
- **Typographie** : Cormorant Garamond pour les titres éditoriaux ; Manrope pour l’interface, les tarifs et les libellés ; solutions de repli système.
- **Essence** : une expérience de réservation soignée pour des clientes qui cherchent une manucure personnelle au Bénin, sans surpromesse ; caractère : raffinée, précise, chaleureuse.
- **Voix** : calme, experte et concrète. Exemples : « Une pose pensée pour vous. » ; « Choisissez votre prestation, nous nous occupons du détail. »
- **Wordmark** : nom du salon configurable avec un petit sigle en forme d’amande tracé d’un seul filet ; aucun faux nom de marque imposé.
- **Couleur signature** : bordeaux raisin `#6B2D45`.

## Raffinement immersif demandé le 8 novembre

L’ancienne composition CSS en couches ne répond pas à la demande de décomposition « comme un assemblage de précision ». La remplacer par une vraie scène WebGL Three.js de matière ongulaire fabriquée avec des géométries légères, avec sept éléments distincts (ongle support, base, gel de structure, couleur, voile chrome, décoration et finition transparente). GSAP ScrollTrigger synchronise la progression à un panneau épinglé et à un défilement natif ; étapes, repères et contenu suivent les couches qui se séparent. Une commande de navigation des étapes reste disponible si le défilement animé est désactivé. Le pointeur peut incliner doucement la scène, jamais la piloter à la place du défilement. La scène reste une illustration de nail art et non une simulation AR.

Initialiser Three.js et GSAP uniquement côté client, adapter la taille du renderer au conteneur et limiter la résolution de rendu des écrans denses ; centraliser la libération des géométries, matériaux, renderer, observateurs, listeners et contexte ScrollTrigger lors d’un échec ou au démontage, et ignorer le retour d’imports asynchrones après démontage. Garder un repli éditorial si WebGL échoue. Suivre `prefers-reduced-motion`, et offrir un contrôle administratif pour désactiver les effets de défilement.

Ajouter des réglages d’apparence JSON par salon sans nouvelle table ou clé globale : thème par défaut `brand|light|dark`, boutons `pill|soft|square`, commutateur visiteuse avec préférence conservée localement, glassmorphism activable/désactivable, animations de défilement, scène 3D, icônes flottantes, densité et opacité. L’endpoint public ne publie qu’un objet d’apparence nettoyé par liste blanche. L’administration existante enregistre ces paramètres avec la même vérification de session/rôle et le même `salon_id`. Adapter le composant fourni : remplacer ses symboles martiaux et références `/img` indisponibles par des motifs Lucide liés au nail art, garder un budget réduit sur mobile, aucun clic capturé, décor masqué aux technologies d’assistance et arrêt des minuteurs lorsque l’onglet est caché.

Le style reste éditorial ivoire/bordeaux ; les panneaux en verre n’apparaissent que là où ils améliorent la profondeur, avec contraste lisible. Les transitions thème/panneaux doivent être rapides et interrompues si le navigateur demande moins de mouvement. Ne pas modifier la portée de réservation ni les données sensibles pour les besoins visuels.

## Accès invité et paiements tardifs

La récupération d’une réservation invitée utilise la référence et le téléphone déjà associés au rendez-vous, envoie un code aléatoire à six chiffres seulement à un canal de contact déjà enregistré et configuré, puis consomme atomiquement le code à la validation. L’empreinte HMAC-SHA-256 utilise `BETTER_AUTH_SECRET`, est liée au challenge, expire après dix minutes et est limitée à cinq tentatives ; le jeton invité précédent est remplacé par un nouveau jeton aléatoire à durée limitée. Les réponses de demande ne révèlent pas l’existence du rendez-vous ; les points de terminaison appliquent un rate limit ; la file de notification masque le code dans l’admin et l’efface après succès ou expiration. La table de challenge reste liée par salon et réservation.

Un paiement manuel reçu après l’expiration, l’annulation, le début du rendez-vous ou un conflit de planning est conservé comme paiement à revoir, mais ne fait pas passer l’état du rendez-vous à confirmé. L’API PATCH admin ne confirme pas non plus une retenue arrivée à son heure de début ; son UPDATE conditionnel vérifie encore l’heure et l’expiration dans la transaction. Les confirmations manuelles et les raisons/auteurs sont historisés ; le montant encaissé et le solde ne sont jamais déduits d’une simple confirmation d’équipe. La logique de webhook FedaPay suit le même principe de libération et de rapprochement.

## Livraison

L’application suit les conventions Nuxt 4 avec rendu serveur et API Nitro. Les données sont multi-salon (`salon_id`) et les rôles/contrôles sont vérifiés à chaque endpoint privé. Les services tiers sont optionnels seulement faute de clés, avec `.env.example`, adaptateurs et consignes de configuration. Tests unitaires des règles ; tests d’intégration des endpoints et transactions si la base est disponible ; e2e du parcours navigable quand le runtime le permet. Les rapports finaux distinguent clairement ce qui est implémenté, ce qui a été exécuté et ce qui attend des identifiants ou une validation de la propriétaire.
