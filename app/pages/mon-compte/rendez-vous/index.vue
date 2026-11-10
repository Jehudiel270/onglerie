<script setup lang="ts">
import { CalendarDays, ArrowRight } from '@lucide/vue'
import { SALON_TIMEZONE,formatXof } from '~~/shared/constants/business'
definePageMeta({middleware:'customer'})
type AccountVisit={id:string;reference:string;status:string;startsAt:string;totalXof:number;amountPaidXof:number;remainingXof:number;services:Array<{name:string}>}
const{data,error}=await useFetch<{appointments:AccountVisit[]}>('/api/account/appointments',{key:'account-appointments'})
function date(value:string){return new Intl.DateTimeFormat('fr-BJ',{timeZone:SALON_TIMEZONE,dateStyle:'full',timeStyle:'short'}).format(new Date(value))}
function serviceNames(items:AccountVisit['services']){return items.map((item)=>item.name).join(' · ')}
useSeoMeta({title:'Mes rendez-vous — Votre onglerie',robots:'noindex,nofollow'})
</script>
<template><div v-reveal.stagger class="container-page visits-page"><PageIntro eyebrow="Mon espace" title="Mes rendez-vous." description="Vos rendez-vous passés et à venir, ainsi que leur état de paiement."/><div v-if="error" class="empty-state">Connectez une réservation à votre compte pour voir vos rendez-vous.</div><div v-else-if="data?.appointments.length" class="visit-list"><article v-for="item in data.appointments" :key="item.id" class="surface-card visit-card"><CalendarDays :size="18"/><div><strong>{{serviceNames(item.services)}}</strong><small>{{date(item.startsAt)}} · {{item.reference}}</small></div><span class="status-pill">{{item.status}}</span><strong>{{formatXof(item.totalXof)}}</strong><NuxtLink class="link-arrow" :to="`/mon-compte/rendez-vous/${item.id}`">Détail <ArrowRight :size="14"/></NuxtLink></article></div><div v-else class="empty-state">Aucun rendez-vous relié à ce compte.</div></div></template>
<style scoped>.visits-page{padding-bottom:3rem}.visit-list{display:grid;gap:.65rem}.visit-card{display:grid;grid-template-columns:auto 1.4fr auto auto auto;align-items:center;gap:1rem;padding:1rem}.visit-card div{display:grid;gap:.25rem}.visit-card strong{font-size:.74rem}.visit-card small{color:var(--muted);font-size:.62rem}@media(max-width:750px){.visit-card{grid-template-columns:auto 1fr}.visit-card>*:nth-child(n+3){grid-column:2}}</style>
