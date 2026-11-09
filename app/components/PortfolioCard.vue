<script setup lang="ts">
import { ArrowUpRight, Sparkles } from '@lucide/vue'
import type { PortfolioCard as PortfolioCardType } from '~~/shared/types/catalog'

defineProps<{ item: PortfolioCardType; demo?: boolean }>()
</script>

<template>
  <article class="inspiration-card">
    <NuxtLink class="inspiration-card__image" :to="`/realisations/${item.slug}`">
      <img v-if="item.imageUrls[0]" :src="item.imageUrls[0]" :alt="demo ? `Image éditoriale d’inspiration : ${item.title}` : item.title" loading="lazy" decoding="async" width="700" height="850">
      <span v-else class="inspiration-placeholder"><Sparkles :size="26" /></span>
      <span v-if="item.trend" class="trend-mark">Tendance</span>
    </NuxtLink>
    <div class="inspiration-card__details">
      <div><span>{{ item.category }} <template v-if="item.style">· {{ item.style }}</template></span><h3><NuxtLink :to="`/realisations/${item.slug}`">{{ item.title }}</NuxtLink></h3></div>
      <NuxtLink class="round-link" :to="`/realisations/${item.slug}`" :aria-label="`Découvrir ${item.title}`"><ArrowUpRight :size="17" /></NuxtLink>
    </div>
    <p class="inspiration-card__note" v-if="demo">Image d’inspiration générée — non présentée comme une réalisation du salon</p>
  </article>
</template>

<style scoped>
.inspiration-card{min-width:0}.inspiration-card__image{position:relative;display:block;overflow:hidden;aspect-ratio:4/5;border-radius:1.2rem;background:#e7dbd6}.inspiration-card__image img{width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}.inspiration-card__image:hover img{transform:scale(1.05)}.inspiration-placeholder{display:grid;width:100%;height:100%;place-items:center;color:var(--merlot);background:radial-gradient(circle,#fff9f3,#e4d5d0)}.trend-mark{position:absolute;top:.8rem;left:.8rem;border-radius:999px;padding:.35rem .65rem;color:white;background:var(--merlot);font-size:.58rem;font-weight:700;letter-spacing:.04em}.inspiration-card__details{display:flex;align-items:center;justify-content:space-between;gap:.7rem;padding:.9rem .1rem .15rem}.inspiration-card__details span{color:var(--muted);font-size:.61rem}.inspiration-card h3{margin:.15rem 0 0;font-family:var(--font-display);font-size:1.45rem;font-weight:600;line-height:1.1}.round-link{display:grid;width:38px;height:38px;flex:0 0 38px;place-items:center;border:1px solid rgba(107,45,69,.2);border-radius:50%;color:var(--merlot)}.round-link:hover{color:white;background:var(--merlot)}.inspiration-card__note{margin:.25rem 0 0;color:#8d765c;font-size:.58rem;line-height:1.45}
</style>
