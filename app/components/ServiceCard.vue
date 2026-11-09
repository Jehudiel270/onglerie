<script setup lang="ts">
import { ArrowUpRight, Clock3 } from '@lucide/vue'
import type { ServiceCard as ServiceCardType } from '~~/shared/types/catalog'
import { formatXof } from '~~/shared/constants/business'

defineProps<{ service: ServiceCardType; demo?: boolean }>()
</script>

<template>
  <article class="service-card">
    <NuxtLink class="service-card__image" :to="`/prestations/${service.slug}`">
      <img v-if="service.imageUrl" :src="service.imageUrl" :alt="`Visuel indicatif pour ${service.name}`" loading="lazy" decoding="async" width="720" height="900">
      <span v-else class="image-placeholder"><span class="brand-mark"><span /></span></span>
      <span class="service-card__category">{{ service.category }}</span>
    </NuxtLink>
    <div class="service-card__body">
      <div class="service-card__title"><h3><NuxtLink :to="`/prestations/${service.slug}`">{{ service.name }}</NuxtLink></h3><span class="service-card__price">{{ formatXof(service.priceXof) }}</span></div>
      <p>{{ service.description }}</p>
      <div class="service-card__bottom"><span><Clock3 :size="14" /> {{ service.durationMinutes }} min</span><NuxtLink class="link-arrow" :to="`/prestations/${service.slug}`">Découvrir <ArrowUpRight :size="15" /></NuxtLink></div>
      <small v-if="demo" class="service-card__demo">Tarif et visuel d’exemple</small>
    </div>
  </article>
</template>

<style scoped>
.service-card{overflow:hidden;border:1px solid rgba(107,45,69,.1);border-radius:1.1rem;background:var(--paper);box-shadow:var(--shadow-soft)}
.service-card__image{position:relative;display:block;height:285px;overflow:hidden;background:#eadfda}.service-card__image img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}.service-card__image:hover img{transform:scale(1.04)}
.service-card__category{position:absolute;bottom:.85rem;left:.85rem;border:1px solid rgba(255,255,255,.75);border-radius:999px;padding:.3rem .65rem;color:#3a252b;background:rgba(255,253,249,.86);font-size:.59rem;font-weight:700}
.image-placeholder{display:grid;width:100%;height:100%;place-items:center;background:radial-gradient(circle at 50% 40%,#fff7ef,#e7d5d0)}.image-placeholder .brand-mark{position:relative;display:grid;width:68px;height:68px;place-items:center;border:1px solid var(--merlot);border-radius:50%;transform:rotate(-10deg)}.image-placeholder .brand-mark:before{content:"";width:21px;height:42px;border:1px solid var(--merlot);border-radius:70% 70% 45% 45%}
.service-card__body{padding:1.1rem 1.1rem 1rem}.service-card__title{display:flex;align-items:start;justify-content:space-between;gap:.5rem}.service-card h3{margin:0;font-family:var(--font-display);font-size:1.55rem;font-weight:600;line-height:1.1}.service-card__price{white-space:nowrap;color:var(--merlot);font-size:.72rem;font-weight:800}.service-card p{min-height:3rem;margin:.65rem 0 1rem;color:var(--muted);font-size:.75rem}.service-card__bottom{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:.8rem}.service-card__bottom>span{display:flex;align-items:center;gap:.4rem;color:#71645e;font-size:.68rem}.service-card__bottom .link-arrow{font-size:.68rem}.service-card__demo{display:block;margin-top:.7rem;color:#927b63;font-size:.58rem}
</style>
