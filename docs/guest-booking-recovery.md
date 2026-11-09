# Récupération sécurisée d’une réservation invitée

La route publique `/reservation/recuperer` permet à une cliente qui a perdu son jeton de suivi de retrouver sa réservation avec la référence et le numéro béninois déjà rattachés à celle-ci. Elle ne permet pas de choisir une nouvelle adresse ou un nouveau numéro de destination.

## Parcours technique

1. Le navigateur appelle `POST /api/public/booking-recovery/request` avec la référence et le numéro saisis. Le serveur normalise ce numéro, cherche une correspondance dans le même rendez-vous et le même salon, puis choisit une destination déjà enregistrée. Si l’adresse e-mail du dossier et le connecteur e-mail sont configurés, le code part par e-mail ; sinon il peut utiliser WhatsApp si le numéro enregistré et un modèle Meta approuvé sont configurés.
2. Une demande valide produit un code aléatoire à six chiffres. Seule son empreinte HMAC-SHA-256, calculée avec `BETTER_AUTH_SECRET` et liée à l’identifiant aléatoire du challenge, est stockée dans `guest_recovery_challenges`. Le secret doit contenir au moins 32 octets. Ce HMAC empêche une énumération hors ligne de l’espace OTP après une fuite de la base. Le code expire dix minutes après sa création ; une nouvelle demande consomme les challenges précédents du rendez-vous.
3. Le worker de notifications vérifie qu’un code est toujours actif avant l’envoi. Après livraison, ou lorsque le code est expiré/consommé, le payload de l’outbox est réduit à la référence : le code n’y demeure que le temps nécessaire à une tentative de livraison.
4. `POST /api/public/booking-recovery/verify` applique les limites de débit IP/téléphone/challenge et verrouille le challenge sélectionné. Cinq erreurs consomment le challenge. Une validation réussie marque le code comme consommé et renouvelle le jeton d’accès invité (jeton aléatoire, seule son empreinte est conservée dans la table de rendez-vous, durée 30 jours). Le nouveau jeton est transmis une seule fois au navigateur et placé dans `sessionStorage` avant d’ouvrir la page de suivi.

Les demandes de code répondent de la même manière lorsqu’une référence/numéro ne correspond pas ou lorsqu’aucun canal n’est configuré, afin d’éviter l’énumération des références. La vérification renvoie un message générique en cas de code absent, incorrect, consommé ou expiré. Les réponses ne sont pas mises en cache ; les références, numéros et codes ne sont pas écrits dans les journaux applicatifs par ces endpoints. Les vues et réponses d’administration masquent aussi le code et le destinataire ; une relance après effacement du payload ne peut pas envoyer un code vide.

## Configuration des messages

- E-mail : `EMAIL_API_URL`, `EMAIL_API_KEY` et `EMAIL_FROM` côté serveur.
- WhatsApp : `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` et `WHATSAPP_TEMPLATE_BOOKING_RECOVERY` côté serveur. Le modèle Meta doit être approuvé en français et accepter deux paramètres texte dans le corps : code, durée en minutes.
- Neon : `NEON_DATABASE_URL` et migration `server/db/migrations/0001_guest_recovery_challenges.sql` à appliquer avant d’activer la fonctionnalité.
- Le worker d’envoi est le même adaptateur outbox utilisé par les autres notifications. Une API de demande de code n’affirme pas qu’un message a été livré ; sans fournisseur configuré, la cliente doit contacter le salon par les coordonnées publiques.

Ne pas copier de vrais codes, numéros ou jetons dans les issues, journaux, captures d’écran ou jeux de test. L’intégration d’envoi réel doit être testée avec des destinataires appartenant à un environnement isolé.
