<script setup lang="ts">
import { ArrowUpDown,Search } from '@lucide/vue'
import type { PublicCatalog } from '~~/shared/types/catalog'

const {data:catalog}=await useFetch<PublicCatalog>('/api/public/catalog',{key:'public-catalog'})
const search=ref('')
const category=ref('Toutes')
const sort=ref('recommended')
const categories=computed(()=>['Toutes',...(catalog.value?.serviceCategories??[])])
const services=computed(()=>{
  const query=search.value.trim().toLocaleLowerCase('fr')
  const rows=(catalog.value?.services??[]).filter((item)=>(category.value==='Toutes'||item.category===category.value)&&`${item.name} ${item.description} ${item.category}`.toLocaleLowerCase('fr').includes(query))
  return [...rows].sort((a,b)=>sort.value==='price-asc'?a.priceXof-b.priceXof:sort.value==='duration-asc'?a.durationMinutes-b.durationMinutes:Number(b.featured)-Number(a.featured))
})
const title='Prestations ongulaires — Soins, poses & tarifs'
const description='Parcourez les prestations, comparez durées et tarifs indicatifs, puis choisissez une option pour votre prochain rendez-vous.'
useSeoMeta({title,description,ogTitle:title,ogDescription:description,ogType:'website',twitterCard:'summary'})
</script>

<template>
  <div>
    <PageIntro eyebrow="Le catalogue du salon" title="Le soin, à votre mesure." description="Comparez les prestations, les durées et les prix renseignés par l’équipe. Les tarifs d’exemple sont clairement signalés."/>
    <div class="container-page">
      <div v-if="catalog?.demo" class="demo-note">Catalogue de démonstration : prestations, tarifs et images ci-dessous sont indicatifs et restent à confirmer par le salon.</div>
      <div class="catalog-tools">
        <label class="search-control"><Search :size="17"/><input v-model="search" type="search" placeholder="Rechercher une prestation" aria-label="Rechercher une prestation"/></label>
        <label class="filter-control"><span>Catégorie</span><select v-model="category" class="form-control"><option v-for="item in categories" :key="item">{{item}}</option></select></label>
        <label class="filter-control"><span><ArrowUpDown :size="13"/> Trier par</span><select v-model="sort" class="form-control"><option value="recommended">Recommandées</option><option value="price-asc">Prix croissant</option><option value="duration-asc">Durée croissante</option></select></label>
      </div>
      <div v-if="services.length" v-reveal.stagger class="catalog-grid"><ServiceCard v-for="service in services" :key="service.id" :service="service" :demo="Boolean(catalog?.demo)"/></div>
      <div v-else class="empty-state"><strong>Aucune prestation à afficher.</strong><p>Essayez une autre recherche ou contactez le salon pour connaître son catalogue.</p><NuxtLink class="btn btn-secondary" to="/contact">Contacter le salon</NuxtLink></div>
    </div>
  </div>
</template>

<style scoped>
.catalog-tools{display:grid;grid-template-columns:minmax(220px,1fr) minmax(170px,.45fr) minmax(180px,.55fr);gap:1rem;margin:1rem 0 2rem}
.search-control{display:flex;min-height:48px;align-items:center;gap:.65rem;border:1px solid var(--line);border-radius:.75rem;padding:0 .85rem;color:var(--muted);background:var(--paper)}
.search-control input{width:100%;border:0;outline:0;background:transparent;font-size:.77rem}
.filter-control{display:grid;gap:.35rem}
.filter-control>span{display:flex;align-items:center;gap:.25rem;color:var(--muted);font-size:.62rem;font-weight:700}
.filter-control .form-control{min-height:48px;font-size:.74rem}
.catalog-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2rem;padding-bottom:2rem}
.demo-note{margin-bottom:1.2rem}
@media(max-width:760px){.catalog-tools{grid-template-columns:1fr 1fr}.search-control{grid-column:1/-1}.catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:540px){.catalog-tools,.catalog-grid{grid-template-columns:1fr}.service-card :deep(.service-card__image){height:300px}}
</style>
