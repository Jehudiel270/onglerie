# Configuration sécurisée des intégrations

Les identifiants de fournisseurs sont des secrets d’environnement du projet, pas des paramètres du salon. Ne jamais les enregistrer dans `salon_settings`, un formulaire accessible au navigateur, un commit, un message public ou une capture d’écran. L’administration de l’onglerie peut présenter un état « configuré / à configurer », mais ne doit ni afficher ni collecter les valeurs des clés.

Depuis le dashboard du projet WebDev, utiliser l’entrée sécurisée **Secrets / Environment variables** (ou la carte sécurisée ouverte par Manus) pour enregistrer les valeurs dans l’environnement de développement ou de production correspondant. Développement et production sont indépendants ; ajouter une clé en développement ne la rend pas disponible en production. Après un changement, redémarrer le processus de développement ou redéployer l’environnement concerné si nécessaire.

## Variables par intégration

| Fonction | Clés côté serveur | Remarques |
| --- | --- | --- |
| Neon PostgreSQL | `NEON_DATABASE_URL`, `NEON_DATABASE_URL_UNPOOLED` | URL poolée pour le runtime ; URL directe non-poolée pour Drizzle Kit et les migrations. Ne pas utiliser le `DATABASE_URL` MySQL de la plateforme. |
| Authentification | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Le secret doit contenir au moins 32 octets ; il protège également les empreintes HMAC des codes OTP de récupération. |
| FedaPay | `FEDAPAY_ENV`, `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET` | Commencer en `sandbox`; vérifier les URLs de webhook avant d’activer la production. |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | `API_SECRET` reste exclusivement serveur ; les uploads sont signés via l’API admin. |
| Tâches planifiées | `CRON_SECRET`, `BOOKING_HOLD_MINUTES` | Une valeur forte et privée est requise pour protéger les routes planifiées. |
| WhatsApp Business Cloud | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_TEMPLATE_*` | Les noms des modèles doivent exister et être approuvés dans Meta. |
| E-mail transactionnel | `EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM` | L’URL fournisseur est configurée en HTTPS ; aucun fournisseur n’est présumé. |
| Premier propriétaire (ponctuel) | `BOOTSTRAP_OWNER_NAME`, `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_PASSWORD`, `BOOTSTRAP_SALON_NAME`, `BOOTSTRAP_SALON_SLUG`, `BOOTSTRAP_SALON_CITY`, `ALLOW_OWNER_BOOTSTRAP` | Ne configurer que pour l’opération de bootstrap autorisée ; le mot de passe initial doit avoir au moins 14 caractères, inclure minuscule, majuscule et chiffre, puis être retiré de l’environnement après création. |

La liste exacte et les commentaires sont fournis dans `.env.example`. Les valeurs d’exemple y sont vides. Aucun identifiant FedaPay, Cloudinary, Neon ou fournisseur de notification n’est livré avec ce dépôt.

## Migration et premier compte propriétaire

Avant `pnpm db:migrate`, confirmer que l’URL correspond à la branche/base Neon voulue et utiliser `NEON_DATABASE_URL_UNPOOLED`. Vérifier la liste des migrations et leur contenu versionné ; ne jamais tester une migration sur la base de production partagée. Après une migration réussie, `pnpm bootstrap:owner` est réservé à la création du premier propriétaire : définir `ALLOW_OWNER_BOOTSTRAP=YES_CREATE_FIRST_OWNER` pour cette seule commande, puis retirer toutes les variables bootstrap. Le script refuse de modifier un compte déjà propriétaire et crée une appartenance owner au salon indiqué. N’exécuter qu’une fois, avec une identité et un salon fournis par leur propriétaire.

Le Git distant canonique du projet Manus est distinct d’un dépôt GitHub personnel. Pour GitHub, connecter le dépôt désiré via l’intégration GitHub autorisée ; ne pas stocker un PAT dans `.git/config`, l’URL du remote, `.env.example` ou le code. Si un jeton est exposé dans une conversation ou un log, le révoquer et en créer un nouveau depuis le gestionnaire officiel.
