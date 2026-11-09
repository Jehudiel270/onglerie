# Données de démonstration

Les cartes et photos affichées lorsque Neon n’est pas configuré sont des contenus **visuels d’exemple**. Les libellés, prestations, prix XOF et durées sont explicitement marqués comme à confirmer. Les images éditoriales ont été générées pour la direction artistique et ne sont jamais présentées comme des réalisations authentiques du salon.

En production, l’API publique lit le catalogue et le portfolio persistés dans Neon. Elle ne mélange pas des lignes de démonstration avec les données réelles. Les réservations et paiements restent désactivés jusqu’à configuration de la base et des fournisseurs correspondants ; aucune confirmation ni succès fictif n’est créé.

Il n’existe volontairement aucune commande qui insère automatiquement des tarifs, horaires ou réalisations fictifs dans la base opérationnelle : la base administrée, les tests et la production partagent le même service de données. Le mode démonstration préremplit uniquement les réponses publiques non persistées. Configurez le salon, ajoutez des professionnelles, puis saisissez vos tarifs et vos horaires réels depuis `/admin` avant d’activer les réservations.
