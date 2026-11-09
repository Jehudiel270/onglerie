<script setup lang="ts">
import { Moon, Palette, Sun } from '@lucide/vue'
import type { ThemeMode } from '~~/shared/constants/appearance'
const { selectedTheme, selectTheme } = useSiteAppearance()
const choices: Array<{ value: ThemeMode; label: string; icon: typeof Palette }> = [
  { value: 'brand', label: 'Thème de marque', icon: Palette },
  { value: 'light', label: 'Thème clair', icon: Sun },
  { value: 'dark', label: 'Thème sombre', icon: Moon },
]
</script>

<template>
  <div class="theme-switcher" role="group" aria-label="Choisir le thème du site">
    <button v-for="choice in choices" :key="choice.value" class="theme-switcher__button" type="button" :aria-label="choice.label" :aria-pressed="selectedTheme === choice.value" :title="choice.label" @click="selectTheme(choice.value)">
      <component :is="choice.icon" :size="15" :stroke-width="1.8" />
    </button>
  </div>
</template>

<style scoped>
.theme-switcher { display: inline-flex; align-items: center; gap: .22rem; border: 1px solid color-mix(in srgb,var(--merlot) 18%,transparent); border-radius: 999px; padding: .2rem; background: color-mix(in srgb,var(--paper) 74%,transparent); backdrop-filter: blur(14px); }
.theme-switcher__button { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 50%; color: var(--muted); background: transparent; cursor: pointer; transition: color .25s ease, background .35s ease, transform .35s cubic-bezier(.2,.8,.2,1); }
.theme-switcher__button:hover { color: var(--merlot); transform: rotate(-8deg); }
.theme-switcher__button[aria-pressed="true"] { color: var(--paper); background: var(--merlot); }
.theme-switcher__button:focus-visible { outline: 2px solid var(--merlot); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .theme-switcher__button { transition: none; } }
</style>
