# Recherche technique — 3D synchronisée au défilement

## Choix appliqués

L’expérience utilise la scène WebGL pour représenter séparément les matières d’une pose. La progression native du document anime leur séparation ; GSAP ScrollTrigger fournit le mode `pin`/`scrub` et son callback de progression convient aux transformations de groupes Three.js. La documentation décrit aussi le recalcul responsive et les callbacks de progression. La scène ne doit pas détourner ou remplacer le scroll natif. [1]

Three.js recommande de dimensionner le canvas par CSS et d’aligner la caméra/résolution de dessin à la taille réelle du conteneur. Pour préserver la batterie et le débit GPU mobiles, plafonner le DPR/rasterisation plutôt que calculer systématiquement sur l’intégralité d’un écran haute densité. [2]

La scène étant montée depuis une page Nuxt, libérer les géométries, matériaux, renderer, écouteurs et triggers lors de son démontage. Garder une alternative qui explique le procédé si le contexte WebGL n’est pas disponible. [3]

Désactiver l’inclinaison, les transformations liées au scroll et les animations flottantes lorsque `prefers-reduced-motion: reduce` est actif. La préférence vise à supprimer, réduire ou remplacer les animations non essentielles, notamment les grands déplacements et agrandissements qui peuvent déclencher un inconfort vestibulaire. [4]

## Implications produit

Les couches sculptées sont une illustration esthétique, pas une simulation de manucure, de peau ou de résultat sur cliente. Une liste d’étapes textuelles fonctionne comme alternative de navigation et maintient la description accessible au clavier. Les paramètres du salon sont un défaut visuel et ne désactivent jamais la préférence réduite choisie sur l’appareil.

## Références

[1]: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ "GSAP ScrollTrigger"
[2]: https://threejs.org/manual/pages/responsive.html "Three.js responsive design"
[3]: https://threejs.org/manual/pages/cleanup.html "Three.js cleanup manual"
[4]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion "MDN prefers-reduced-motion"
