<script setup lang="ts">
import { ArrowUpRight, Camera, MapPin, Phone } from '@lucide/vue'
const config = useRuntimeConfig()
const { data: content } = await useFetch<{ siteName?: string; phone?: string; whatsapp?: string; address?: string; city?: string; instagram?: string }>('/api/public/content', { key: 'salon-public-content' })
const year = new Date().getFullYear()
const phoneLink = computed(() => String(content.value?.phone || config.public.salonPhone || '').replace(/[^+\d]/g, ''))
const whatsappLink = computed(() => { const raw = String(content.value?.whatsapp || config.public.salonWhatsApp || '').replace(/\D/g, ''); return raw ? `https://wa.me/${raw}` : '' })
const salonName = computed(() => content.value?.siteName || config.public.siteName || 'Votre onglerie')
</script>

<template>
  <footer class="site-footer">
    <div class="container-page">
      <div class="site-footer__top">
        <div class="footer-brand"><span class="eyebrow">Rendez-vous & informations</span><h2 class="display">Un moment<br>pour vous.</h2><p>Les coordonnées et horaires sont renseignés par l’équipe du salon.</p><NuxtLink class="btn btn-light" to="/reservation">Prendre rendez-vous <ArrowUpRight :size="16" /></NuxtLink></div>
        <div class="footer-column"><span class="footer-label">Explorer</span><NuxtLink to="/prestations">Prestations</NuxtLink><NuxtLink to="/realisations">Inspirations</NuxtLink><NuxtLink to="/a-propos">À propos</NuxtLink><NuxtLink to="/faq">Questions fréquentes</NuxtLink></div>
        <div class="footer-column footer-contact"><span class="footer-label">Nous contacter</span><a v-if="phoneLink" :href="`tel:${phoneLink}`"><Phone :size="15" /> {{ content?.phone }}</a><NuxtLink v-else to="/contact"><Phone :size="15" /> Téléphone à renseigner</NuxtLink><a v-if="whatsappLink" :href="whatsappLink" target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight :size="14" /></a><NuxtLink v-else to="/contact">WhatsApp à renseigner</NuxtLink><span><MapPin :size="15" /> {{ content?.address || 'Adresse à renseigner' }}<template v-if="content?.city">, {{ content.city }}</template></span><a v-if="content?.instagram" :href="content.instagram" target="_blank" rel="noreferrer"><Camera :size="15" /> Instagram</a></div>
      </div>
      <div class="site-footer__bottom"><span>© {{ year }} {{ salonName }} · Coordonnées à confirmer par le salon</span><div><NuxtLink to="/conditions-generales">Conditions</NuxtLink><NuxtLink to="/politique-confidentialite">Confidentialité</NuxtLink><NuxtLink to="/politique-annulation">Annulation</NuxtLink><NuxtLink to="/mentions-legales">Mentions légales</NuxtLink></div></div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer{margin-top:7rem;padding:4.5rem 0 1.4rem;color:#f8f0e9;background:#2b2223}.site-footer__top{display:grid;grid-template-columns:1.4fr .75fr 1fr;gap:3rem;padding-bottom:3.6rem}.footer-brand .eyebrow{color:#dfadb3}.footer-brand h2{margin:1rem 0 .7rem;font-size:clamp(3rem,5vw,4.5rem)}.footer-brand p{max-width:330px;margin-bottom:1.6rem;color:#c3b4ad;font-size:.83rem}.footer-column{display:flex;flex-direction:column;align-items:flex-start;gap:.75rem;padding-top:.25rem}.footer-column a,.footer-column span:not(.footer-label){display:inline-flex;align-items:center;gap:.55rem;color:#e7ddd6;font-size:.76rem}.footer-column a:hover{color:#dfadb3}.footer-label{margin-bottom:.45rem;color:#caa7a5;font-size:.64rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.site-footer__bottom{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid rgba(255,255,255,.16);padding-top:1.15rem;color:#bcafa8;font-size:.64rem}.site-footer__bottom>div{display:flex;flex-wrap:wrap;gap:1.1rem}.site-footer__bottom a:hover{color:white}
@media(max-width:720px){.site-footer{margin-top:4.5rem;padding-top:3rem}.site-footer__top{grid-template-columns:1fr 1fr;gap:2rem 1rem}.footer-brand,.footer-contact{grid-column:1/-1}.site-footer__bottom{flex-direction:column}}
</style>
