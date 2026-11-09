<script setup lang="ts">
import { normalizeSalonAppearance } from '~~/shared/constants/appearance'
type PublicAppearanceResponse = { appearance?: unknown }
const { data: publicSettings } = await useFetch<PublicAppearanceResponse>('/api/public/content', { key: 'salon-public-content' })
const { appearance } = useSiteAppearance()
watch(() => publicSettings.value?.appearance, (value) => { appearance.value = normalizeSalonAppearance(value) }, { immediate: true, deep: true })
</script>

<template>
  <div class="page-shell public-page-shell" :data-button-style="appearance.buttonStyle">
    <FloatingIcons v-if="appearance.floatingIconsEnabled" :density="appearance.floatingIconDensity" :opacity="appearance.floatingIconOpacity" />
    <div class="public-content-layer">
      <SiteHeader />
      <main id="main-content"><slot /></main>
      <SiteFooter />
    </div>
  </div>
</template>

<style scoped>
.public-page-shell { position: relative; isolation: isolate; }
.public-page-shell[data-button-style='soft'] { --public-button-radius: .8rem; }
.public-page-shell[data-button-style='pill'] { --public-button-radius: 999px; }
.public-page-shell[data-button-style='square'] { --public-button-radius: .2rem; }
.public-content-layer { position: relative; z-index: 1; min-height: 100vh; }
</style>
