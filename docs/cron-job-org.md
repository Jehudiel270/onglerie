# Tâches planifiées via cron-job.org (plan Vercel Hobby)

Vercel Hobby n'autorise qu'un cron par jour. Les trois tâches de la plateforme
ont donc été retirées de `vercel.json` et doivent être appelées par le service
gratuit [cron-job.org](https://cron-job.org), qui permet une granularité à la
minute.

## Endpoints à déclarer

| Tâche | URL à appeler | Fréquence recommandée | Rôle |
|---|---|---|---|
| Expiration des retenues | `https://VOTRE-DOMAINE/api/cron/expire-holds` | Toutes les 5 minutes | Passe en `expired` les réservations dont l'acompte n'a pas été payé dans le délai |
| File de notifications | `https://VOTRE-DOMAINE/api/cron/notifications` | Toutes les 5 minutes | Envoie les e-mails (Brevo) et WhatsApp en file, avec tentatives et backoff |
| Rappels de rendez-vous | `https://VOTRE-DOMAINE/api/cron/reminders` | Toutes les 15 minutes | Programme les rappels 24 h et 2 h avant chaque rendez-vous |

## Étapes dans cron-job.org

1. Créez un compte gratuit puis **Cronjobs → Create cronjob**.
2. **Title** : « Onglerie — expire-holds » (puis les deux autres).
3. **URL** : collez l'URL du tableau ci-dessus (remplacez `VOTRE-DOMAINE` par
   l'URL Vercel finale, ex. `https://onglerie-carrel.vercel.app`).
4. Onglet **Advanced** → **Header fields** → ajoutez :
   - Name : `Authorization`
   - Value : `Bearer <CRON_SECRET>` (la valeur de `CRON_SECRET` définie dans
     les variables d'environnement Vercel).
5. **Schedule** : « Every 5 minutes » (ou l'expression `*/5 * * * *`) pour les
   deux premières ; `*/15 * * * *` pour les rappels.
6. **Notifications** (optionnel) : activez l'e-mail en cas d'échec répété.
7. Sauvegardez puis **Start** ; l'historique d'exécution s'affiche dans
   « History » (code 200 attendu avec `{"ok":true,...}`).

## Sécurité

- Chaque endpoint compare l'en-tête `Authorization: Bearer …` (ou
  `x-cron-secret`) à `CRON_SECRET` et renvoie 401 sinon. Ne partagez jamais ce
  secret ailleurs que dans Vercel et cron-job.org.
- Les endpoints sont idempotents : un double appel ne crée pas de doublon
  (verrous transactionnels + clés de déduplication).
- Si vous passez au plan Vercel Pro, vous pouvez remettre les crons dans
  `vercel.json` ; cron-job.org peut alors être conservé comme secours.
