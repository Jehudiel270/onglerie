<script setup lang="ts">
import { ArrowRight,Menu,X } from '@lucide/vue'
const config=useRuntimeConfig()
const{data:content}=await useFetch<{siteName?:string}>('/api/public/content',{key:'salon-public-content'})
const open=ref(false)
const links=[{label:'Accueil',to:'/'},{label:'Prestations',to:'/prestations'},{label:'Inspirations',to:'/realisations'},{label:'À propos',to:'/a-propos'},{label:'Contact',to:'/contact'}]
const salonName=computed(()=>content.value?.siteName||String(config.public.siteName||'Votre onglerie'))
</script>
<template>
  <header class="site-header">
    <div class="container-page site-header__inner">
      <NuxtLink class="brand-lockup" to="/" aria-label="Accueil du salon">
        <img class="brand-symbol" src="/images/onglerie-mark.svg" width="38" height="38" alt="" aria-hidden="true"/>
        <span class="brand-name">{{salonName}}<small>STUDIO ONGULAIRE</small></span>
      </NuxtLink>
      <nav class="site-nav" aria-label="Navigation principale">
        <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="site-nav__link" active-class="is-active" @click="open=false">{{link.label}}</NuxtLink>
      </nav>
      <ThemeSwitcher class="header-theme-switcher" />
      <NuxtLink class="header-book btn btn-primary" to="/reservation">Réserver <ArrowRight :size="15" :stroke-width="1.8"/></NuxtLink>
      <button class="mobile-menu" type="button" :aria-expanded="open" :aria-controls="'mobile-navigation'" :aria-label="open?'Fermer le menu':'Ouvrir le menu'" @click="open=!open"><X v-if="open" :size="22"/><Menu v-else :size="22"/></button>
    </div>
    <nav v-if="open" id="mobile-navigation" class="mobile-nav" aria-label="Navigation mobile">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to" @click="open=false">{{link.label}}</NuxtLink>
      <div class="mobile-theme"><span>Apparence</span><ThemeSwitcher /></div>
      <NuxtLink class="mobile-nav__cta" to="/reservation" @click="open=false">Prendre rendez-vous <ArrowRight :size="16"/></NuxtLink>
    </nav>
  </header>
</template>
<style scoped>
.site-header{position:sticky;z-index:30;top:0;border-bottom:1px solid color-mix(in srgb,var(--merlot) 10%,transparent);background:color-mix(in srgb,var(--page) 91%,transparent);backdrop-filter:blur(16px)}.site-header__inner{display:flex;height:82px;align-items:center;justify-content:space-between;gap:.7rem}.brand-lockup{display:inline-flex;align-items:center;gap:.75rem;min-width:185px}.brand-symbol{width:38px;height:38px;object-fit:cover;flex:none}.brand-name{display:flex;max-width:185px;flex-direction:column;overflow:hidden;color:var(--ink);font-family:var(--font-display);font-size:1.18rem;font-weight:600;line-height:1;text-overflow:ellipsis;white-space:nowrap}.brand-name small{margin-top:.34rem;color:var(--muted);font-family:var(--font-sans);font-size:.47rem;font-weight:700;letter-spacing:.17em}.site-nav{display:flex;align-items:center;gap:clamp(1rem,2.3vw,2rem)}.site-nav__link{position:relative;padding:.5rem 0;color:var(--muted);font-size:.72rem;font-weight:600}.site-nav__link:hover,.site-nav__link.is-active{color:var(--merlot)}.site-nav__link.is-active:after{position:absolute;right:0;bottom:.12rem;left:0;height:1px;background:var(--merlot);content:""}.header-book{min-height:42px;padding:.65rem 1.05rem;font-size:.7rem}.mobile-menu,.mobile-nav{display:none}.mobile-theme{display:flex;align-items:center;justify-content:space-between;padding:.65rem max(calc((100vw - 1180px)/2),16px);color:var(--muted);font-size:.7rem;font-weight:700}
@media(max-width:850px){.site-header__inner{height:72px}.site-nav,.header-book,.header-theme-switcher{display:none}.mobile-menu{display:grid;width:44px;height:44px;place-items:center;border:1px solid var(--line);border-radius:50%;color:var(--ink);background:transparent}.mobile-nav{position:absolute;top:100%;right:0;left:0;display:grid;gap:0;border-bottom:1px solid var(--line);padding:.5rem 1rem 1rem;background:var(--page);box-shadow:var(--shadow-soft)}.mobile-nav a{display:flex;min-height:48px;align-items:center;justify-content:space-between;border-bottom:1px solid color-mix(in srgb,var(--merlot) 9%,transparent);padding-inline:max(calc((100vw - 1180px)/2),16px);font-size:.9rem}.mobile-nav__cta{color:var(--merlot);font-weight:700}}
@media(prefers-reduced-motion:reduce){.site-header{backdrop-filter:none}}
</style>
