<script setup lang="ts">
import { ArrowDown, ArrowUp, Layers3, Move3d, RotateCcw } from '@lucide/vue'
import type { SalonAppearance } from '~~/shared/constants/appearance'

type Layer = { title: string; caption: string; detail: string; color: string }
const props = defineProps<{ settings: SalonAppearance }>()
const layers: Layer[] = [
  { title: 'Support', caption: 'La forme amande', detail: 'Une silhouette de démonstration donne sa ligne à la composition.', color: '#cf9f98' },
  { title: 'Base', caption: 'L’adhérence', detail: 'Une première couche lisse prépare la superposition des matières.', color: '#e8c7bd' },
  { title: 'Structure', caption: 'Le volume', detail: 'Le gel de construction dessine la courbe et protège la forme.', color: '#f4dcd0' },
  { title: 'Couleur', caption: 'Le voile prune', detail: 'Un pigment profond pose la couleur de cette composition éditoriale.', color: '#6b2d45' },
  { title: 'Chrome', caption: 'Le reflet nacré', detail: 'Un voile lumineux accroche la lumière sans masquer la teinte.', color: '#d8b9b0' },
  { title: 'Décor', caption: 'Le détail précieux', detail: 'Une pierre facettée ajoute un point de lumière à la pose.', color: '#e9d5c9' },
  { title: 'Finition', caption: 'Le dernier éclat', detail: 'Un film transparent scelle les couches et révèle leur brillance.', color: '#f5e7e5' },
]
const activeStep = ref(0)
const progressValue = ref(0)
const canvasHost = ref<HTMLDivElement | null>(null)
const scrollSection = ref<HTMLElement | null>(null)
const pinPanel = ref<HTMLElement | null>(null)
const sceneReady = ref(false)
const sceneFailed = ref(false)
const reducedMotion = ref(false)
const scrollActive = ref(false)
const progressPercent = computed(() => Math.round(progressValue.value * 100))
const currentLayer = computed(() => layers[activeStep.value] || layers[0]!)

let resizeObserver: ResizeObserver | undefined
let mediaQuery: MediaQueryList | undefined
let renderer: import('three').WebGLRenderer | undefined
let scene: import('three').Scene | undefined
let camera: import('three').PerspectiveCamera | undefined
let modelRoot: import('three').Group | undefined
let layerObjects: import('three').Object3D[] = []
let three: typeof import('three') | undefined
let gsapInstance: typeof import('gsap').gsap | undefined
let trigger: { start: number; end: number; progress: number; kill: () => void } | undefined
let scrollPlugin: typeof import('gsap/ScrollTrigger').ScrollTrigger | undefined
let pointerHandler: ((event: PointerEvent) => void) | undefined
let disposed = false
let progressProxy = { value: 0 }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t) }

function updateProgress(value: number) {
  const progress = clamp(value, 0, 1)
  progressValue.value = progress
  activeStep.value = Math.min(layers.length - 1, Math.floor(progress * layers.length))
  if (!three || !modelRoot || !renderer || !scene || !camera) return
  const vectors = [
    [-0.48, -0.56, -0.22], [-0.31, -0.34, -0.13], [-0.16, -0.14, -0.04],
    [0.08, 0.10, 0.08], [0.26, 0.36, 0.18], [0.42, 0.61, 0.27], [0.50, 0.88, 0.38],
  ]
  layerObjects.forEach((object, index) => {
    const localProgress = smooth(progress * (layers.length + 1) - index * 0.9)
    const vector = vectors[index] || [0, 0, 0]
    object.position.set(vector[0]! * localProgress, vector[1]! * localProgress, index * 0.035 + vector[2]! * localProgress)
    object.rotation.z = (index - 3) * 0.018 * localProgress
  })
  if (modelRoot) {
    modelRoot.rotation.z = -0.12 + progress * 0.10
    modelRoot.rotation.y = 0.10 + progress * 0.07
    modelRoot.scale.setScalar(1 - progress * 0.035)
  }
  camera.position.z = 8.6 - progress * 0.16
  renderer.render(scene, camera)
}

function createNailShape(THREE: typeof import('three'), scale = 1) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 1.72 * scale)
  shape.bezierCurveTo(0.31 * scale, 1.49 * scale, 0.65 * scale, 1.22 * scale, 0.69 * scale, 0.78 * scale)
  shape.bezierCurveTo(0.75 * scale, 0.16 * scale, 0.70 * scale, -0.72 * scale, 0.43 * scale, -1.34 * scale)
  shape.bezierCurveTo(0.27 * scale, -1.72 * scale, 0.12 * scale, -1.80 * scale, 0, -1.81 * scale)
  shape.bezierCurveTo(-0.12 * scale, -1.80 * scale, -0.27 * scale, -1.72 * scale, -0.43 * scale, -1.34 * scale)
  shape.bezierCurveTo(-0.70 * scale, -0.72 * scale, -0.75 * scale, 0.16 * scale, -0.69 * scale, 0.78 * scale)
  shape.bezierCurveTo(-0.65 * scale, 1.22 * scale, -0.31 * scale, 1.49 * scale, 0, 1.72 * scale)
  return shape
}

function createLayer(THREE: typeof import('three'), index: number, color: string) {
  const scale = [1, 0.96, 0.92, 0.86, 0.86, 0.82, 0.88][index] || 0.85
  const shape = createNailShape(THREE, scale)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: index === 6 ? 0.045 : 0.11, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 20 })
  let material: import('three').Material
  if (index === 3) material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.23, metalness: 0.04, clearcoat: 0.78, clearcoatRoughness: 0.14 })
  else if (index === 4) material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.19, metalness: 0.68, clearcoat: 0.5, clearcoatRoughness: 0.16 })
  else if (index === 6) material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.36, clearcoat: 1, clearcoatRoughness: 0.07, depthWrite: false })
  else material = new THREE.MeshPhysicalMaterial({ color, roughness: index < 3 ? 0.32 : 0.23, metalness: 0.02, clearcoat: 0.64, clearcoatRoughness: 0.2 })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.z = index * 0.035
  mesh.castShadow = false
  mesh.receiveShadow = true
  return mesh
}

function resizeScene() {
  if (!renderer || !camera || !canvasHost.value) return
  const width = Math.max(1, Math.floor(canvasHost.value.clientWidth))
  const height = Math.max(1, Math.floor(canvasHost.value.clientHeight))
  const ratio = Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.2 : 1.55)
  renderer.setPixelRatio(1)
  renderer.setSize(Math.round(width * ratio), Math.round(height * ratio), false)
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.render(scene!, camera)
}

function disposeScene() {
  mediaQuery?.removeEventListener?.('change', onMotionPreference)
  mediaQuery = undefined
  if (pointerHandler && canvasHost.value) canvasHost.value.removeEventListener('pointermove', pointerHandler)
  pointerHandler = undefined
  resizeObserver?.disconnect()
  resizeObserver = undefined
  trigger?.kill()
  trigger = undefined
  try { scrollPlugin?.refresh() } catch { /* ScrollTrigger peut être partiellement initialisé. */ }
  gsapInstance?.killTweensOf(progressProxy)
  if (modelRoot) {
    modelRoot.traverse((object) => {
      const mesh = object as import('three').Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
      materials.forEach((material) => material.dispose())
    })
    scene?.remove(modelRoot)
  }
  try { renderer?.dispose() } catch { /* Libérer les ressources restantes même si le renderer échoue. */ }
  renderer?.domElement.remove()
  try { renderer?.forceContextLoss() } catch { /* Certains navigateurs ont déjà perdu le contexte WebGL. */ }
  renderer = undefined
  scene = undefined
  camera = undefined
  modelRoot = undefined
  layerObjects = []
  three = undefined
  gsapInstance = undefined
  scrollPlugin = undefined
  sceneReady.value = false
  scrollActive.value = false
}

async function mountScene() {
  if (!canvasHost.value) return
  try {
    const [THREE, gsapModule, triggerModule] = await Promise.all([import('three'), import('gsap'), import('gsap/ScrollTrigger')])
    if (disposed || !canvasHost.value) return
    three = THREE
    gsapInstance = gsapModule.gsap
    scrollPlugin = triggerModule.ScrollTrigger
    gsapInstance.registerPlugin(scrollPlugin)
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0, 8.6)
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.setAttribute('aria-label', 'Illustration tridimensionnelle des couches d’une pose ongulaire')
    renderer.domElement.className = 'nail-stage-canvas'
    canvasHost.value.appendChild(renderer.domElement)
    scene.add(new THREE.HemisphereLight('#fff8f2', '#70505b', 2.15))
    const keyLight = new THREE.DirectionalLight('#fff5e9', 3.2)
    keyLight.position.set(-4, 5, 7)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight('#cc8297', 24, 18)
    rimLight.position.set(3.3, 1.6, 4.4)
    scene.add(rimLight)
    const fillLight = new THREE.PointLight('#f4cbb6', 14, 16)
    fillLight.position.set(-3, -2.5, 3.2)
    scene.add(fillLight)
    modelRoot = new THREE.Group()
    modelRoot.rotation.x = -0.10
    scene.add(modelRoot)
    layers.forEach((layer, index) => {
      const mesh = createLayer(THREE, index, layer.color)
      layerObjects.push(mesh)
      modelRoot!.add(mesh)
    })
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 2), new THREE.MeshPhysicalMaterial({ color: '#fff0df', roughness: 0.12, metalness: 0.18, clearcoat: 1, emissive: '#a76b72', emissiveIntensity: 0.08 }))
    gem.position.set(0.33, 0.30, 0.22)
    gem.rotation.set(0.35, 0.2, 0.15)
    modelRoot.add(gem)
    layerObjects[5]?.add(gem)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 10, 36), new THREE.MeshStandardMaterial({ color: '#f1d7bd', metalness: 0.76, roughness: 0.24 }))
    ring.position.set(0.33, 0.30, 0.21)
    layerObjects[5]?.add(ring)
    resizeObserver = new ResizeObserver(resizeScene)
    resizeObserver.observe(canvasHost.value)
    resizeScene()
    pointerHandler = (event: PointerEvent) => {
      if (!modelRoot || event.pointerType === 'touch' || reducedMotion.value) return
      const rect = canvasHost.value!.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      modelRoot.rotation.x = -0.10 - y * 0.14
      modelRoot.rotation.y = 0.10 + x * 0.20
      renderer?.render(scene!, camera!)
    }
    canvasHost.value.addEventListener('pointermove', pointerHandler)
    sceneReady.value = true
    sceneFailed.value = false
    const canScrollAnimate = props.settings.scrollAnimationsEnabled && !reducedMotion.value && window.matchMedia('(min-width: 721px)').matches
    if (canScrollAnimate && scrollSection.value && pinPanel.value) {
      trigger = scrollPlugin.create({
        trigger: scrollSection.value,
        pin: pinPanel.value,
        start: 'top top',
        end: () => `+=${window.innerHeight * props.settings.scrollDurationScreens}`,
        scrub: 0.72,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self: { isActive: boolean }) => { scrollActive.value = self.isActive },
        onUpdate: (self: { progress: number; start: number; end: number }) => {
          progressProxy.value = self.progress
          updateProgress(self.progress)
        },
      })
      scrollActive.value = Boolean(trigger)
      requestAnimationFrame(() => { if (!disposed) scrollPlugin?.refresh() })
    }
    updateProgress(0)
  } catch {
    if (!disposed) sceneFailed.value = true
    disposeScene()
  }
}

function goToStep(index: number) {
  const target = clamp(index, 0, layers.length - 1) / (layers.length - 1)
  if (trigger && scrollPlugin && props.settings.scrollAnimationsEnabled && !reducedMotion.value) {
    const distance = trigger.end - trigger.start
    window.scrollTo({ top: trigger.start + target * distance, behavior: reducedMotion.value ? 'auto' : 'smooth' })
    return
  }
  if (gsapInstance && !reducedMotion.value) {
    gsapInstance.to(progressProxy, { value: target, duration: 0.7, ease: 'power2.inOut', onUpdate: () => updateProgress(progressProxy.value) })
  } else updateProgress(target)
}

function onMotionPreference(event: MediaQueryListEvent | MediaQueryList) {
  reducedMotion.value = event.matches
  if (event.matches) {
    trigger?.kill()
    trigger = undefined
    scrollActive.value = false
    updateProgress(0)
  } else if (sceneReady.value && props.settings.scrollAnimationsEnabled && window.matchMedia('(min-width: 721px)').matches && scrollPlugin && scrollSection.value && pinPanel.value) {
    trigger = scrollPlugin.create({ trigger: scrollSection.value, pin: pinPanel.value, start: 'top top', end: () => `+=${window.innerHeight * props.settings.scrollDurationScreens}`, scrub: 0.72, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: (self: { progress: number }) => updateProgress(self.progress) })
  }
}

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = mediaQuery.matches
  mediaQuery.addEventListener?.('change', onMotionPreference)
  void mountScene()
})

onBeforeUnmount(() => {
  disposed = true
  disposeScene()
})
</script>

<template>
  <section ref="scrollSection" class="nail-experience" aria-labelledby="nail-stage-title">
    <div ref="pinPanel" class="nail-experience__panel">
      <div class="nail-experience__heading">
        <div>
          <span class="eyebrow">Une pose, en détail</span>
          <h2 id="nail-stage-title" class="display">Le beau se joue<br><em>dans les couches.</em></h2>
        </div>
        <p class="nail-experience__intro">Suivez la construction d’une pose, matière après matière. Cette scène est une illustration, pas un essayage sur votre main.</p>
      </div>
      <div class="nail-experience__body">
        <div class="layer-guide">
          <div class="layer-guide__current" aria-live="polite"><span class="layer-guide__eyebrow">ÉTAPE {{ String(activeStep + 1).padStart(2, '0') }} / 07</span><h3>{{ currentLayer.caption }}</h3><p>{{ currentLayer.detail }}</p></div>
          <ol class="layer-guide__list" aria-label="Étapes de décomposition">
            <li v-for="(layer, index) in layers" :key="layer.title">
              <button type="button" :aria-current="activeStep === index ? 'step' : undefined" :aria-label="`Étape ${index + 1} : ${layer.caption}`" @click="goToStep(index)">
                <span class="layer-guide__number">{{ String(index + 1).padStart(2, '0') }}</span><span class="layer-guide__title">{{ layer.title }}</span><span class="layer-guide__line" />
              </button>
            </li>
          </ol>
          <span class="layer-guide__hint"><ArrowDown :size="13"/> Faites défiler ou choisissez une étape</span>
        </div>
        <div class="nail-stage-card" :class="{ 'is-ready': sceneReady, 'is-failed': sceneFailed }">
          <div class="nail-stage-card__top"><span><Layers3 :size="13"/> VUE EN COUCHES</span><span class="nail-stage-card__index">OBJET 01 · MATIÈRES & FINITIONS</span></div>
          <div ref="canvasHost" class="nail-stage-canvas-host" role="img" :aria-label="`Illustration d’une pose ongulaire en couches, étape ${activeStep + 1} : ${currentLayer.caption}`">
            <div class="nail-fallback" aria-hidden="true"><i v-for="index in 7" :key="index" :style="{ '--layer': index }" /></div>
            <span v-if="sceneFailed" class="nail-stage-fallback-note">Illustration 3D indisponible sur cet appareil — les étapes restent consultables.</span>
          </div>
          <div class="nail-stage-card__bottom">
            <div class="stage-progress" role="progressbar" aria-label="Progression de la décomposition" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${progressPercent}%` }"/></div>
            <span class="stage-controls-note"><Move3d :size="13"/> {{ reducedMotion ? 'Animations réduites selon votre appareil' : scrollActive ? 'Décomposition synchronisée au défilement' : 'Choisissez une étape ou explorez en faisant défiler' }}</span>
            <button class="stage-reset" type="button" aria-label="Réassembler la pose" title="Revenir à la pose assemblée" @click="goToStep(0)"><RotateCcw :size="15"/><span>Réassembler</span></button>
          </div>
          <span class="nail-stage-orbit nail-stage-orbit--one" aria-hidden="true"/><span class="nail-stage-orbit nail-stage-orbit--two" aria-hidden="true"/><ArrowUp class="nail-stage-direction" :size="14" aria-hidden="true"/>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nail-experience{position:relative;width:100%;padding-block:1.5rem}.nail-experience__panel{display:grid;min-height:min(860px,100svh);grid-template-rows:auto minmax(0,1fr);gap:1.5rem;align-content:center;padding:clamp(1rem,3.5vw,3rem) 0}.nail-experience__heading{display:flex;align-items:end;justify-content:space-between;gap:2.5rem}.nail-experience__heading h2{margin:.7rem 0 0;font-size:clamp(2.8rem,5.6vw,5.2rem)}.nail-experience__heading h2 em{color:var(--merlot);font-weight:400}.nail-experience__intro{max-width:340px;margin:0 0 .45rem;color:var(--muted);font-size:.79rem}.nail-experience__body{display:grid;min-height:450px;grid-template-columns:minmax(220px,.55fr) minmax(0,1.45fr);gap:clamp(1.2rem,4vw,4rem);align-items:stretch}.layer-guide{display:flex;flex-direction:column;justify-content:center;padding:1rem 0}.layer-guide__current{min-height:125px}.layer-guide__eyebrow{color:var(--merlot);font-size:.56rem;font-weight:800;letter-spacing:.16em}.layer-guide__current h3{margin:.35rem 0;font-family:var(--font-display);font-size:clamp(1.6rem,2.5vw,2.35rem);font-weight:500;line-height:1}.layer-guide__current p{max-width:280px;color:var(--muted);font-size:.68rem;line-height:1.55}.layer-guide__list{display:grid;gap:.15rem;margin:.8rem 0 1rem;padding:0;list-style:none}.layer-guide__list button{display:grid;width:100%;min-height:31px;grid-template-columns:28px auto 1fr;align-items:center;gap:.5rem;border:0;padding:0;color:var(--muted);text-align:left;background:transparent;cursor:pointer}.layer-guide__number{color:#9c8b84;font-size:.56rem;font-weight:700;letter-spacing:.1em}.layer-guide__title{font-size:.68rem;font-weight:600;transition:color .25s ease}.layer-guide__line{height:1px;background:color-mix(in srgb,var(--merlot) 12%,transparent);transition:background .25s ease}.layer-guide__list button[aria-current="step"] .layer-guide__number,.layer-guide__list button[aria-current="step"] .layer-guide__title{color:var(--merlot)}.layer-guide__list button[aria-current="step"] .layer-guide__line{background:var(--rose)}.layer-guide__list button:focus-visible{outline:2px solid var(--merlot);outline-offset:2px}.layer-guide__hint{display:flex;align-items:center;gap:.35rem;color:var(--muted);font-size:.57rem}.nail-stage-card{position:relative;display:grid;min-height:450px;grid-template-rows:auto minmax(280px,1fr) auto;overflow:hidden;border:1px solid color-mix(in srgb,var(--merlot) 14%,transparent);border-radius:1.4rem;background:radial-gradient(ellipse at 50% 47%,color-mix(in srgb,var(--paper) 96%,transparent),color-mix(in srgb,var(--rose) 12%,var(--page)) 68%,color-mix(in srgb,var(--merlot) 7%,var(--page)));box-shadow:0 24px 65px rgba(63,35,43,.08);isolation:isolate}.nail-stage-card__top,.nail-stage-card__bottom{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:1rem 1.15rem}.nail-stage-card__top>span:first-child{display:flex;align-items:center;gap:.4rem;color:var(--merlot);font-size:.54rem;font-weight:800;letter-spacing:.13em}.nail-stage-card__index{color:var(--muted);font-size:.5rem;font-weight:700;letter-spacing:.12em}.nail-stage-canvas-host{position:relative;z-index:1;min-height:290px;overflow:hidden}.nail-stage-canvas-host :deep(canvas){position:absolute;inset:0;display:block;width:100%;height:100%;outline:none}.nail-fallback{position:absolute;top:50%;left:50%;width:148px;height:274px;transform:translate(-50%,-50%) rotate(-14deg) rotateX(18deg);transform-style:preserve-3d;transition:opacity .4s ease}.nail-fallback i{position:absolute;inset:calc((var(--layer) - 1)*2px);border:1px solid rgba(83,42,55,.18);border-radius:50% 50% 42% 42%/30% 30% 18% 18%;background:linear-gradient(112deg,#c89891,#f4e0d9 39%,#865263 100%);box-shadow:0 5px 9px rgba(67,34,43,.1);transform:translateY(calc((var(--layer) - 4)*1px)) translateZ(calc((var(--layer) - 4)*2px))}.nail-fallback i:nth-child(4){background:linear-gradient(115deg,#3e1b2b,#8b435c 46%,#5c273f)}.nail-fallback i:nth-child(5){background:linear-gradient(120deg,transparent 27%,rgba(255,239,221,.82) 39%,transparent 54%,rgba(228,177,184,.7) 70%,transparent 79%)}.nail-fallback i:nth-child(6){inset:42% 31% auto auto;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,white,#c6a68d 72%)}.nail-fallback i:nth-child(7){background:linear-gradient(130deg,rgba(255,255,255,.4),rgba(255,255,255,.04))}.nail-stage-card.is-ready .nail-fallback{opacity:0}.nail-stage-card.is-failed .nail-fallback{opacity:1}.nail-stage-fallback-note{position:absolute;right:1rem;bottom:.25rem;left:1rem;color:var(--muted);font-size:.62rem;text-align:center}.nail-stage-card__bottom{display:grid;grid-template-columns:1fr auto;gap:.45rem 1rem;border-top:1px solid color-mix(in srgb,var(--merlot) 12%,transparent);background:color-mix(in srgb,var(--paper) 42%,transparent);backdrop-filter:blur(18px)}.stage-progress{height:2px;grid-column:1/-1;overflow:hidden;border-radius:99px;background:color-mix(in srgb,var(--merlot) 12%,transparent)}.stage-progress span{display:block;height:100%;border-radius:inherit;background:var(--merlot);transition:width .08s linear}.stage-controls-note{display:flex;align-items:center;gap:.35rem;color:var(--muted);font-size:.56rem}.stage-reset{display:inline-flex;align-items:center;gap:.35rem;border:0;padding:.3rem;color:var(--merlot);font-size:.6rem;font-weight:700;background:transparent;cursor:pointer}.nail-stage-orbit{position:absolute;z-index:0;top:28%;left:18%;width:64%;height:40%;border:1px solid color-mix(in srgb,var(--merlot) 9%,transparent);border-radius:50%;transform:rotateX(65deg) rotate(-24deg);pointer-events:none}.nail-stage-orbit--two{top:33%;left:24%;width:52%;height:34%;border-style:dashed;transform:rotateX(69deg) rotate(27deg)}.nail-stage-direction{position:absolute;top:50%;right:1.15rem;color:var(--rose);opacity:.8}.nail-experience :deep(.nail-stage-canvas){touch-action:pan-y}.nail-experience :deep(.nail-stage-card){backdrop-filter:blur(18px)}
html[data-theme="dark"] .nail-stage-card{border-color:color-mix(in srgb,var(--merlot) 28%,transparent);box-shadow:0 26px 80px rgba(0,0,0,.24)}
html[data-glass="false"] .nail-stage-card__bottom{backdrop-filter:none}
@media(max-width:900px){.nail-experience__panel{min-height:100svh}.nail-experience__body{grid-template-columns:minmax(190px,.62fr) minmax(0,1.38fr);gap:1rem}.nail-stage-card{min-height:420px}.nail-stage-canvas-host{min-height:270px}}
@media(max-width:720px){.nail-experience{padding-block:.8rem}.nail-experience__panel{min-height:100svh;gap:.8rem;padding:5rem 0 1rem}.nail-experience__heading{display:block}.nail-experience__heading h2{font-size:clamp(2.5rem,10vw,4rem)}.nail-experience__intro{max-width:460px;margin-top:.6rem;font-size:.68rem}.nail-experience__body{min-height:0;grid-template-columns:1fr;gap:.5rem}.layer-guide{padding:0}.layer-guide__current{min-height:75px}.layer-guide__current h3{font-size:1.55rem}.layer-guide__current p{max-width:100%;margin:.2rem 0;font-size:.63rem}.layer-guide__list{display:flex;gap:.35rem;overflow-x:auto;margin:.25rem 0 .6rem;padding:0 0 .35rem;scrollbar-width:thin}.layer-guide__list li{flex:0 0 auto}.layer-guide__list button{display:flex;min-height:32px;gap:.3rem;border:1px solid color-mix(in srgb,var(--merlot) 14%,transparent);border-radius:999px;padding:0 .62rem}.layer-guide__line{display:none}.layer-guide__title{font-size:.59rem}.layer-guide__number{font-size:.5rem}.layer-guide__list button[aria-current="step"]{border-color:var(--merlot);background:color-mix(in srgb,var(--rose) 16%,var(--page))}.layer-guide__hint{display:none}.nail-stage-card{min-height:0;grid-template-rows:auto minmax(230px,1fr) auto;border-radius:1.1rem}.nail-stage-card__top,.nail-stage-card__bottom{padding:.65rem .75rem}.nail-stage-card__index{font-size:.43rem}.nail-stage-canvas-host{min-height:clamp(225px,39svh,360px)}.nail-fallback{width:115px;height:216px}.stage-controls-note{font-size:.5rem}.stage-reset{font-size:.53rem}.nail-stage-direction{display:none}}
@media(max-height:680px) and (max-width:720px){.nail-experience__panel{padding-top:4rem}.nail-experience__heading h2{font-size:2.3rem}.nail-stage-canvas-host{min-height:195px}.nail-stage-card__top,.nail-stage-card__bottom{padding-block:.48rem}}
@media(prefers-reduced-motion:reduce){.nail-experience *{scroll-behavior:auto!important;transition:none!important}.nail-experience__panel{min-height:auto}}
</style>
