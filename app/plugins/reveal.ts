// Directive v-reveal : apparition au défilement via IntersectionObserver.
// Usages :
//   v-reveal                     → montée douce
//   v-reveal.left / .right       → translation latérale
//   v-reveal.zoom                → léger zoom
//   v-reveal.stagger             → les enfants directs apparaissent en cascade
//   v-reveal="{ delay: 120 }"    → décalage en millisecondes
// Les classes d'animation ne sont posées qu'au montage côté client : le rendu
// SSR reste neutre (aucune page invisible sans JavaScript, aucun écart
// d'hydratation), et le mouvement repose uniquement sur des animations CSS
// (opacity/transform) pour ne pas perturber les transitions d'interface.
let observer: IntersectionObserver | null = null

function revealObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('rv-in')
        observer?.unobserve(entry.target)
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
  }
  return observer
}

type RevealValue = number | { delay?: number } | undefined

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    getSSRProps: () => ({}),
    mounted(el: HTMLElement, binding: { arg?: string; value?: RevealValue }) {
      const delay = typeof binding.value === 'number' ? binding.value : binding.value?.delay ?? 0
      if (binding.arg === 'stagger') {
        el.classList.add('rv-stagger')
      } else {
        el.classList.add('rv')
        if (binding.arg === 'left') el.classList.add('rv--left')
        else if (binding.arg === 'right') el.classList.add('rv--right')
        else if (binding.arg === 'zoom') el.classList.add('rv--zoom')
      }
      if (delay) el.style.setProperty('--rv-delay', `${Math.min(delay, 900)}ms`)
      revealObserver().observe(el)
    },
    unmounted(el: HTMLElement) {
      observer?.unobserve(el)
    },
  })
})
