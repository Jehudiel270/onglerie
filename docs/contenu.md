# Contenu du site (clés `site_content`)

La page **Contenu** de l'administration édite des documents JSON stockés dans
la table `site_content`, un par clé. Chaque document est rendu par les pages
publiques correspondantes.

| Clé | Page alimentée | Contenu attendu |
|---|---|---|
| `site` | En-tête/pied globaux | Nom affiché, baseline, contacts, réseaux |
| `home` | `/` (accueil) | Accroche hero, arguments, textes des sections vedettes |
| `about` | `/a-propos` | Histoire, valeurs, équipe, engagements |
| `faq` | `/faq` | Liste de questions regroupées par catégorie |
| `legal` | `mentions-legales`, `conditions-generales`, `politique-confidentialite`, `politique-annulation` | Mentions éditoriales et textes légaux |
| `booking` | `/reservation` | Consignes affichées pendant le parcours de réservation |

## Règles d'édition

- Le JSON est validé côté serveur (Zod) avant enregistrement ; une erreur de
  syntaxe est refusée avec le détail du champ fautif.
- Chaque écriture est journalisée dans `audit_logs` (acteur, clé, date).
- Les pages publiques lisent ces documents en lecture seule via
  `GET /api/public/content` ; en cas d'absence, des valeurs par défaut honnêtes
  sont affichées (pages légales « À compléter »).
- Évitez d'y stocker des informations sensibles : ce contenu est public.
