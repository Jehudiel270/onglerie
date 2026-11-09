<script setup lang="ts">
const config=useRuntimeConfig(),route=useRoute(),origin=usePublicOrigin()
const isPrivate=computed(()=>route.path.startsWith('/admin')||route.path.startsWith('/mon-compte')||['/connexion','/inscription','/reservation/confirmation','/reservation/recuperer'].includes(route.path))
const isDemo=computed(()=>String(config.public.demoMode).toLowerCase()!=='false')
const canonical=computed(()=>origin&&!isPrivate.value&&!isDemo.value?new URL(route.path,origin).toString():undefined)
const robots=computed(()=>isPrivate.value||isDemo.value?'noindex,nofollow':'index,follow')
useSeoMeta({robots,ogSiteName:String(config.public.siteName||'Studio manucure'),twitterCard:'summary_large_image'})
useHead(()=>({link:canonical.value?[{rel:'canonical',href:canonical.value}]:[],meta:[{name:'keywords',content:'onglerie, manucure, nail art, soins des mains, réservation'},...(canonical.value?[{property:'og:url',content:canonical.value}]:[])],script:[{key:'theme-prepaint',tagPosition:'head',innerHTML:"(()=>{try{if(location.pathname.startsWith('/admin'))return;const t=localStorage.getItem('onglerie:theme:v1');if(t==='brand'||t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}})()"}]}))
</script>
<template>
  <NuxtLayout>
    <NuxtLink class="skip-link" to="#main-content">Aller au contenu principal</NuxtLink>
    <NuxtPage/>
  </NuxtLayout>
</template>
<style>
.skip-link{position:fixed;z-index:100;top:1rem;left:1rem;transform:translateY(-160%);border-radius:999px;padding:.65rem 1rem;color:white;background:var(--merlot);font-size:.78rem;font-weight:700}.skip-link:focus{transform:translateY(0)}
</style>
