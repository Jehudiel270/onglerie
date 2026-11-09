<script setup lang="ts">
import { ArrowLeft, ArrowRight, Clock3, ShieldCheck } from '@lucide/vue'
import type { PublicCatalog } from '~~/shared/types/catalog'
import { formatXof } from '~~/shared/constants/business'
const route = useRoute()
const { data: catalog } = await useFetch<PublicCatalog>('/api/public/catalog', { key: 'public-catalog' })
const service = computed(() => catalog.value?.services.find((item) => item.slug === route.params.slug))
if (!service.value) throw createError({ statusCode: 404, statusMessage: 'Cette prestation n’existe pas ou n’est plus publiée.' })
const siteUrl = usePublicOrigin()
const serviceImageUrl = usePublicAssetUrl(service.value.imageUrl)
const title = `${service.value.name} — Prestation ongulaire`
const description = `${service.value.description} Durée indiquée : ${service.value.durationMinutes} minutes. Tarif : ${formatXof(service.value.priceXof)}.`
useSeoMeta({ title, description, ogTitle: title, ogDescription: description, ogType: 'website', ogImage: serviceImageUrl, twitterCard: 'summary_large_image' })
</script>

<template>
  <div v-if="service"><div class="container-page service-detail"><NuxtLink class="back-link" to="/prestations"><ArrowLeft :size="15" /> Toutes les prestations</NuxtLink>
    <div v-if="catalog?.demo" class="demo-note">Fiche d’exemple : le salon doit confirmer le tarif, la durée et les conditions.</div>
    <section class="service-detail__grid"><div class="service-detail__visual"><img v-if="service.imageUrl" :src="service.imageUrl" :alt="`Visuel éditorial indicatif de ${service.name}`" width="900" height="1050"><div v-else class="service-detail__placeholder"><span class="brand-mark"><span /></span></div><small v-if="catalog?.demo">Visuel d’inspiration · pas une réalisation du salon</small></div>
      <div class="service-detail__content"><span class="eyebrow">{{ service.category }}</span><h1 class="display">{{ service.name }}</h1><p class="lead">{{ service.description }}</p><p v-if="service.details" class="service-detail__description">{{ service.details }}</p><div class="service-facts"><div><span>Tarif indiqué</span><strong>{{ formatXof(service.priceXof) }}</strong><small v-if="catalog?.demo">Exemple à confirmer</small></div><div><span>Durée prévue</span><strong><Clock3 :size="16" /> {{ service.durationMinutes }} min</strong></div><div><span>Acompte indiqué</span><strong>{{ formatXof(service.depositXof) }}</strong></div></div><p v-if="service.conditions" class="conditions"><ShieldCheck :size="16" /> {{ service.conditions }}</p><NuxtLink class="btn btn-primary" :to="{ path: '/reservation', query: { service: service.slug } }">Choisir cette prestation <ArrowRight :size="16" /></NuxtLink><p class="detail-footnote">Le montant définitif et le solde s’affichent avant toute confirmation.</p></div>
    </section>
    <section class="service-detail__bottom"><span class="section-kicker">Votre prochain geste</span><h2 class="display">Un créneau à votre rythme.</h2><p>La disponibilité est calculée à partir des horaires réels lorsque le salon a configuré son calendrier.</p><NuxtLink class="link-arrow" to="/reservation">Continuer vers la réservation <ArrowRight :size="15" /></NuxtLink></section>
  </div></div>
</template>

<style scoped>
.service-detail{padding-top:2rem}.back-link{display:inline-flex;align-items:center;gap:.45rem;margin:0 0 1.2rem;color:var(--muted);font-size:.7rem}.service-detail__grid{display:grid;grid-template-columns:minmax(280px,.95fr) minmax(340px,1.05fr);gap:clamp(2rem,6vw,6rem);align-items:center;padding:1rem 0 4rem}.service-detail__visual{overflow:hidden;border-radius:1.35rem;background:#e6d8d1}.service-detail__visual img{width:100%;max-height:640px;aspect-ratio:4/5;object-fit:cover}.service-detail__visual small{display:block;padding:.55rem .75rem;color:#785f4a;background:#f6ead7;font-size:.61rem}.service-detail__placeholder{display:grid;min-height:440px;place-items:center}.service-detail__placeholder .brand-mark{display:grid;width:80px;height:80px;place-items:center;border:1px solid var(--merlot);border-radius:50%}.service-detail h1{margin:.9rem 0 1.2rem;font-size:clamp(3.4rem,6vw,6rem)}.lead{max-width:480px;color:#554642;font-size:1.03rem}.service-detail__description{max-width:500px;color:var(--muted);font-size:.82rem}.service-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;border-block:1px solid var(--line);margin:1.7rem 0;padding:1.1rem 0}.service-facts>div{display:grid;gap:.4rem}.service-facts span,.service-facts small{color:var(--muted);font-size:.6rem}.service-facts strong{display:flex;align-items:center;gap:.3rem;color:var(--merlot);font-size:.76rem}.service-detail .conditions{display:flex;align-items:start;gap:.5rem;color:#6c5e57;font-size:.72rem}.service-detail .conditions svg{flex:0 0 auto;color:var(--merlot)}.detail-footnote{color:#8a7d74;font-size:.64rem}.service-detail__bottom{border-top:1px solid var(--line);padding:3rem 0}.service-detail__bottom h2{margin:.55rem 0;font-size:clamp(2.8rem,5vw,4rem)}.service-detail__bottom p{max-width:460px;color:var(--muted);font-size:.82rem}
@media(max-width:760px){.service-detail__grid{grid-template-columns:1fr;gap:1.7rem}.service-detail__visual img{max-height:500px}.service-facts{gap:.35rem}.service-facts strong{font-size:.69rem}}
</style>
