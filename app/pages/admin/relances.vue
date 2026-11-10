<script setup lang="ts">
import { ExternalLink, Info, MessageCircle, RefreshCw } from '@lucide/vue'
import { SALON_TIMEZONE } from '~~/shared/constants/business'
definePageMeta({ layout: 'admin', middleware: 'admin' })

type Relance = { id: string; reference: string; startsAt: string; day: string; time: string; customer: string; services: string; waLink: string }
const { data, pending, error, refresh } = await useFetch<{ items: Relance[]; guidance: string }>('/api/admin/relances', { key: 'admin-relances' })
const grouped = computed(() => {
  const map = new Map<string, Relance[]>()
  for (const item of data.value?.items || []) {
    const list = map.get(item.day) || []
    list.push(item)
    map.set(item.day, list)
  }
  return [...map.entries()]
})
const todayLabel = new Intl.DateTimeFormat('fr-BJ', { timeZone: SALON_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
useSeoMeta({ title: 'Relances WhatsApp — Administration', robots: 'noindex,nofollow' })
</script>
<template>
  <div>
    <header class="admin-page-head"><div><span class="admin-topbar__eyebrow">Relances</span><h1>WhatsApp manuel</h1><p>Liens wa.me pré-remplis pour les rendez-vous confirmés des 2 prochains jours. Vous envoyez depuis votre propre WhatsApp — aucune API ni aucun coût.</p></div><button class="admin-inline-action" :disabled="pending" @click="refresh()"><RefreshCw :size="14"/> Actualiser</button></header>
    <p class="admin-alert"><Info :size="14"/> Les rappels <strong>automatiques</strong> (e-mail Brevo, WhatsApp Cloud si configuré) partent via les tâches cron-job.org ; cette page est le complément manuel, sans configuration.</p>
    <p v-if="error" class="admin-alert">Impossible de charger les relances.</p>
    <p v-if="!pending && !grouped.length" class="admin-empty">Aucun rendez-vous confirmé dans les 2 prochains jours.</p>
    <section v-for="[day, items] in grouped" :key="day" class="relance-block">
      <h2 class="relance-day">{{day === todayLabel ? "Aujourd’hui" : day}}</h2>
      <article v-for="item in items" :key="item.id" class="admin-card relance-card">
        <div class="relance-info"><strong>{{item.time}} — {{item.customer}}</strong><small>{{item.reference}} · {{item.services}}</small></div>
        <a class="btn btn-primary relance-btn" :href="item.waLink" target="_blank" rel="noopener noreferrer"><MessageCircle :size="15"/> Ouvrir WhatsApp <ExternalLink :size="13"/></a>
      </article>
    </section>
    <p v-if="data?.guidance" class="provider-note">{{data.guidance}}</p>
  </div>
</template>
<style scoped>
.relance-block{margin-bottom:1.5rem}.relance-day{margin:0 0 .6rem;font-family:var(--font-display);font-size:1.35rem;font-weight:500;text-transform:capitalize}
.relance-card{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 1.1rem;margin-bottom:.55rem}
.relance-info strong{display:block;font-size:.8rem}.relance-info small{color:#968981;font-size:.64rem}
.relance-btn{white-space:nowrap}
.provider-note{margin:1.2rem 0;color:#887c74;font-size:.7rem}
</style>
