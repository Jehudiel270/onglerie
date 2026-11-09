<script setup lang="ts">
import { Flower2, Gem, Heart, Paintbrush, Sparkles } from '@lucide/vue'

const props = withDefaults(defineProps<{ density?: number; opacity?: number }>(), { density: 7, opacity: 12 })
const iconPool = [Paintbrush, Gem, Heart, Flower2, Sparkles] as const
const liveIcons = ref<Array<{ id: number; component: typeof Paintbrush; top: number; left: number; size: number; duration: number; drift: number; rotation: number; opacity: number }>>([])
let uid = 0
let spawnTimer: ReturnType<typeof setTimeout> | undefined
let expiryTimer: ReturnType<typeof setInterval> | undefined
let startedAt = new Map<number, number>()

function random(min: number, max: number) { return min + Math.random() * (max - min) }
function spawn() {
  const compact = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 720
  const icon = {
    id: uid++, component: iconPool[Math.floor(Math.random() * iconPool.length)]!,
    top: random(6, 92), left: random(3, 95), size: compact ? random(17, 30) : random(28, 60),
    duration: random(5, 10), drift: random(-30, 30), rotation: random(-26, 26),
    opacity: Math.min(0.24, Math.max(0.03, props.opacity / 100)) * random(0.65, 1.15),
  }
  startedAt.set(icon.id, Date.now())
  return icon
}
function stop() {
  if (spawnTimer) clearTimeout(spawnTimer)
  if (expiryTimer) clearInterval(expiryTimer)
  spawnTimer = undefined
  expiryTimer = undefined
}
function schedule() {
  spawnTimer = setTimeout(() => {
    if (document.hidden) return
    const budget = Math.min(props.density, window.matchMedia('(pointer: coarse)').matches ? 5 : 12)
    if (liveIcons.value.length < budget) liveIcons.value.push(spawn())
    schedule()
  }, random(1300, 2600))
}
function start() {
  if (spawnTimer || expiryTimer || props.density <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return
  const budget = Math.min(props.density, window.matchMedia('(pointer: coarse)').matches ? 5 : 12)
  for (let index = 0; index < Math.min(3, budget); index++) liveIcons.value.push(spawn())
  expiryTimer = setInterval(() => {
    const now = Date.now()
    liveIcons.value = liveIcons.value.filter((icon) => now - (startedAt.get(icon.id) || 0) < 9000)
  }, 900)
  schedule()
}
function onVisibility() {
  stop()
  if (document.hidden) {
    liveIcons.value = []
    startedAt.clear()
  } else start()
}
watch(() => [props.density, props.opacity], () => { stop(); liveIcons.value = []; startedAt.clear(); start() })
onMounted(() => {
  start()
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibility)
  startedAt.clear()
})
</script>

<template>
  <ClientOnly>
    <div class="floating-icons" aria-hidden="true">
      <TransitionGroup name="floating-icons-fade">
        <component :is="icon.component" v-for="icon in liveIcons" :key="icon.id" class="floating-icons__icon" :style="{
          '--icon-top': `${icon.top}%`, '--icon-left': `${icon.left}%`, '--icon-size': `${icon.size}px`,
          '--icon-duration': `${icon.duration}s`, '--icon-drift': `${icon.drift}px`, '--icon-rotation': `${icon.rotation}deg`,
          '--icon-opacity': icon.opacity,
        }" :stroke-width="1.2" />
      </TransitionGroup>
    </div>
  </ClientOnly>
</template>

<style scoped>
.floating-icons { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.floating-icons__icon { position: absolute; top: var(--icon-top); left: var(--icon-left); width: var(--icon-size); height: var(--icon-size); color: var(--rose); opacity: var(--icon-opacity); filter: drop-shadow(0 5px 12px color-mix(in srgb, var(--merlot) 18%, transparent)); animation: nail-drift var(--icon-duration) ease-in-out infinite alternate; }
.floating-icons-fade-enter-active, .floating-icons-fade-leave-active { transition: opacity .8s ease; }
.floating-icons-fade-enter-from, .floating-icons-fade-leave-to { opacity: 0 !important; }
@keyframes nail-drift { to { transform: translate3d(var(--icon-drift), -18px, 0) rotate(var(--icon-rotation)); } }
@media (prefers-reduced-motion: reduce) { .floating-icons__icon { animation: none; } }
</style>
