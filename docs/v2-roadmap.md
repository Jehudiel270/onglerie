# Roadmap V2 — essayage virtuel et extension du produit

## Ce qui est livré dans la MVP

Le site permet de consulter les services configurés, parcourir les références publiées et attacher une référence précise à une demande de rendez-vous. La scène 3D de la landing page est une composition CSS décorative et interactive pour expliquer les couches d’une pose (forme, couleur, effet, finition). Elle ne mesure pas une main et ne simule pas une pose sur une cliente.

Le modèle de contenu garde les champs utiles à une future recommandation — catégorie, couleur, forme, longueur, technique, tags, images de référence et relation vers un rendez-vous — sans capturer de photo de main ni émettre de prédiction.

## Étapes d’évolution

1. **Découverte client** : ateliers d’usage, consentement explicite, définition des appareils minimums et critères de fidélité visuelle.
2. **Capture contrôlée** : prise de photo consentie, traitement sur l’appareil si possible, effacement explicite, aucune conservation par défaut et accès client révocable.
3. **Segmentation d’ongles** : évaluer MediaPipe et un modèle ONNX Runtime Web en comparaison avec une API externe, mesurer précision, latence, couverture appareil et coûts ; obtenir les droits nécessaires pour les modèles et exemples.
4. **Rendu visuel** : superposition via Canvas/WebGL avec éclairage, couleur/forme/longueur paramétrables et avertissement que le rendu est indicatif, non médical et non photoréaliste.
5. **Autres modules** : ne démarrer cheveux, maquillage ou cils qu’après validation séparée de la capture, du modèle, de la confidentialité et de l’expérience.
6. **Produit** : étudier l’app Flutter multiplateforme, recommandations, fidélité et statistiques après consentement, besoins utilisateurs, budget et données suffisantes.

Aucune de ces étapes n’est activée par un bouton de la MVP. Chaque intégration nécessitera une décision explicite, une évaluation des fournisseurs et une revue de protection des données avant déploiement.
