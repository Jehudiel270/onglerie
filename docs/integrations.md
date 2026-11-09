# Intégrations de paiement et de communication

## FedaPay

Le code crée une transaction sur le serveur en XOF, attache une référence interne, enregistre l’attente et demande une URL de checkout hébergée. Le secret privé et le secret webhook sont distincts. Le webhook vérifie le corps HTTP brut et la signature FedaPay, refuse les événements invalides, consigne l’identifiant d’événement, relit la transaction auprès du fournisseur et ne rapproche que si la réservation, le statut approuvé/transféré, le montant et la devise attendus correspondent. Les unicités `provider/event_reference` et `provider/provider_reference` protègent l’idempotence. Le client ne peut ni déclarer un paiement reçu ni confirmer un rendez-vous depuis la query de retour.

Tester seulement avec des clés et webhooks sandbox dédiés. En production, configurer une URL de webhook dans le tableau de bord FedaPay et valider un événement réel de faible montant avec l’exploitant avant d’activer l’acompte. Les remboursements doivent passer par la politique et le circuit autorisés du compte FedaPay ; aucun remboursement automatique n’est présenté comme fonctionnel sans autorisation/API configurée.

## Cloudinary

Les médias sont téléversés directement depuis le navigateur après une signature serveur à courte durée, accessible aux rôles autorisés. Le navigateur reçoit uniquement les éléments nécessaires à la signature et l’URL de résultat ; `CLOUDINARY_API_SECRET` reste server-only. Le schéma accepte les URL Cloudinary HTTPS et chemins du stockage projet, pas les URL arbitraires pour les champs éditoriaux.

## Notifications WhatsApp et e-mail

La file est durable, cloisonnée au salon et dédupliquée par événement. Les tentatives échouées gardent un statut, un code/texte d’erreur borné, un nombre de tentatives et une prochaine échéance ; le traitement planifié protège la lease contre deux workers. WhatsApp exige les modèles approuvés, un numéro et les permissions/contenus Meta conformes. Les variables nomment séparément confirmations, paiements, rappels et message entrant. `wa.me` n’envoie pas une notification métier et ne remplace pas le connecteur.

L’adaptateur e-mail est volontairement générique. Il exige un fournisseur/API réellement choisi (URL, token et expéditeur), utilise TLS et ne suppose aucun nom de fournisseur. L’exploitant doit vérifier destinataires, SPF/DKIM/DMARC, envoi, retours et désinscription lorsque le type de message le demande.

## Tâches planifiées

Une tâche protégée expire les retenues échues et libère les créneaux. Les rappels utilisent les délais JSON du salon et une clé d’idempotence par rendez-vous/canal/modèle. La livraison automatique dépend du fournisseur, du secret `CRON_SECRET`, de la configuration de planification et des templates ; l’état « en file » n’est pas affiché comme « livré ».
