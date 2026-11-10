<script setup lang="ts">
import { Search, ArrowUpDown } from '@lucide/vue'
import type { PublicCatalog } from '~~/shared/types/catalog'
const { data: catalog } = await useFetch<PublicCatalog>('/api/public/catalog', { key: 'public-catalog' })
const query = ref('')
const category = ref('Toutes')
const sort = ref('recent')
const categories = computed(() => ['Toutes', ...(catalog.value?.portfolioCategories ?? [])])
const looks = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('fr')
  const list = (catalog.value?.portfolio ?? []).filter((item) => (category.value === 'Toutes' || item.category === category.value) && `${item.title} ${item.description} ${item.style} ${item.tags.join(' ')}`.toLocaleLowerCase('fr').includes(needle))
  return sort.value === 'trend' ? [...list].sort((a,b) => Number(b.trend)-Number(a.trend)) : list
})
const title='Inspirations nail art — Styles, couleurs & finitions'
const description='Explorez les références publiées par le salon et gardez une pose comme inspiration pour votre réservation.'
useSeoMeta({ title, description, ogType:'website', ogTitle:title, ogDescription:description, twitterCard:'summary' })
</script>

<template><div><PageIntro eyebrow="Carnet d’inspirations" title="Des idées à vous approprier." description="Filtrez par style, couleur ou technique. Une référence publique peut accompagner votre demande de rendez-vous."/><div class="container-page">
  <div v-if="catalog?.demo" class="demo-note">Galerie de démonstration : ces images éditoriales générées ne sont pas des poses réellement réalisées par le salon.</div>
  <div class="portfolio-tools"><label class="search-control"><Search :size="17"/><input v-model="query" type="search" placeholder="Rechercher un style ou un tag" aria-label="Rechercher des inspirations"></label><label class="filter-control"><span>Style</span><select v-model="category" class="form-control"><option v-for="item in categories" :key="item">{{ item }}</option></select></label><label class="filter-control"><span><ArrowUpDown :size="13"/> Trier par</span><select v-model="sort" class="form-control"><option value="recent">À découvrir</option><option value="trend">Tendances</option></select></label></div>
  <div v-if="looks.length" v-reveal.stagger class="portfolio-grid"><PortfolioCard v-for="item in looks" :key="item.id" :item="item" :demo="Boolean(catalog?.demo)"/></div><div v-else class="empty-state"><strong>Aucune référence publiée pour le moment.</strong><p>Les images apparaîtront ici après validation par l’équipe du salon.</p><NuxtLink class="btn btn-secondary" to="/prestations">Découvrir les prestations</NuxtLink></div>
</div></div></template>

<style scoped>
.portfolio-tools{display:grid;grid-template-columns:minmax(220px,1fr) minmax(170px,.45fr) minmax(170px,.5fr);gap:1rem;margin:1rem 0 2rem}.search-control{display:flex;min-height:48px;align-items:center;gap:.65rem;border:1px solid var(--line);border-radius:.75rem;padding:0 .85rem;color:var(--muted);background:var(--paper)}.search-control input{width:100%;border:0;outline:0;background:transparent;font-size:.77rem}.filter-control{display:grid;gap:.35rem}.filter-control>span{display:flex;align-items:center;gap:.3rem;color:var(--muted);font-size:.62rem;font-weight:700}.filter-control .form-control{min-height:48px;font-size:.74rem}.portfolio-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.5rem;padding-bottom:2rem}.portfolio-grid>*:nth-child(3n+2){margin-top:2rem}@media(max-width:760px){.portfolio-tools{grid-template-columns:1fr 1fr}.search-control{grid-column:1/-1}.portfolio-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.portfolio-grid>*:nth-child(3n+2){margin-top:0}}@media(max-width:540px){.portfolio-tools,.portfolio-grid{grid-template-columns:1fr}.portfolio-grid>*:nth-child(3n+2){margin-top:0}}
</style>
