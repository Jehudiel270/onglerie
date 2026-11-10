<script setup lang="ts">
import { ArrowUpRight, CalendarDays, LogOut, Scissors } from '@lucide/vue'
const route = useRoute()
const config = useRuntimeConfig()
const { data: session } = await useFetch<{ user: { name: string; email: string }; role: string; staffProfile: { firstName: string } | null }>('/api/staff/session', { key: 'staff-session', default: () => null as never })
async function logout(){try{await $fetch('/api/auth/sign-out',{method:'POST'})}finally{await navigateTo('/connexion')}}
const roleLabel = computed(() => ({ owner: 'Propriétaire', reception: 'Réception', staff: 'Employé·e' }[session.value?.role ?? 'staff'] ?? 'Équipe'))
</script>
<template><div class="staff-shell"><header class="staff-topbar"><div class="staff-brand"><span class="staff-brand__mark"><Scissors :size="18"/></span><div><strong>Espace équipe</strong><small>{{ config.public.siteName || 'Votre onglerie' }}</small></div></div><nav class="staff-nav" aria-label="Navigation équipe"><NuxtLink to="/staff" :class="['staff-nav__link',{'is-active':route.path==='/staff'}]"><CalendarDays :size="16"/><span>Mon agenda</span></NuxtLink></nav><div class="staff-user"><span class="staff-user__info"><strong>{{session?.user?.name||'Équipe'}}</strong><small>{{roleLabel}}</small></span><button class="staff-logout" @click="logout"><LogOut :size="15"/><span>Quitter</span></button><NuxtLink class="staff-back" to="/"><ArrowUpRight :size="13"/> Site public</NuxtLink></div></header><main class="staff-main"><slot/></main></div></template>
<style>
.staff-shell{min-height:100vh;background:#f4f0eb;color:#2b2422;font-family:var(--font-sans)}
.staff-topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid #e4dcd4;padding:.7rem 1.4rem;background:rgba(255,253,249,.95);backdrop-filter:blur(10px)}
.staff-brand{display:flex;align-items:center;gap:.6rem}.staff-brand__mark{display:grid;width:34px;height:34px;place-items:center;border:1px solid #6b2d45;border-radius:50%;color:#6b2d45;background:#fffdf9}.staff-brand strong{display:block;font-family:var(--font-display);font-size:1.05rem}.staff-brand small{color:#877b73;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase}
.staff-nav{display:flex;gap:.4rem}.staff-nav__link{display:flex;align-items:center;gap:.45rem;border:1px solid #e6dcd3;border-radius:999px;padding:.45rem .9rem;color:#6f625c;font-size:.68rem}.staff-nav__link.is-active{border-color:#6b2d45;color:#6b2d45;background:#f9f0f3}
.staff-user{display:flex;align-items:center;gap:.8rem}.staff-user__info strong{display:block;font-size:.68rem}.staff-user__info small{color:#8a7d75;font-size:.58rem;text-transform:capitalize}
.staff-logout,.staff-back{display:flex;align-items:center;gap:.4rem;border:1px solid #e4d6d6;border-radius:999px;padding:.42rem .8rem;color:#6f625c;background:#fffaf8;font-size:.63rem}.staff-back{color:#6b2d45}
.staff-main{max-width:1100px;margin-inline:auto;padding:1.6rem 1.2rem 3rem}
@media(max-width:700px){.staff-topbar{flex-wrap:wrap}.staff-user{display:none}}
</style>
