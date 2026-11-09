<script setup lang="ts">
import { ShieldAlert } from '@lucide/vue'
defineProps<{ title:string; eyebrow:string; intro:string; sections:{title:string;body:string}[] }>()
</script>

<template><div><PageIntro :eyebrow="eyebrow" :title="title" :description="intro"/><article class="container-narrow legal-content"><div class="legal-warning"><ShieldAlert :size="18"/><p>Contenu de base à compléter par la propriétaire avec les informations exactes du salon et à faire valider selon le droit applicable. Ce texte n’est pas un avis juridique ni une garantie de conformité.</p></div><section v-for="section in sections" :key="section.title"><h2>{{section.title}}</h2><p>{{section.body}}</p></section><p class="legal-footnote">À compléter : raison sociale, identité de l’exploitant, coordonnées, adresse, conditions financières et délais réels du salon.</p></article></div></template>

<style scoped>
.legal-content{padding-bottom:2rem}.legal-warning{display:flex;align-items:start;gap:.8rem;border:1px solid #dfcda9;border-radius:.8rem;padding:1rem;color:#684f34;background:#f7efdf}.legal-warning svg{flex:0 0 auto;margin-top:.15rem}.legal-warning p{margin:0;font-size:.73rem}.legal-content section{border-bottom:1px solid var(--line);padding:1.3rem 0}.legal-content h2{margin:0 0 .5rem;font-family:var(--font-display);font-size:1.65rem;font-weight:600}.legal-content section p{margin:0;color:var(--muted);font-size:.77rem}.legal-footnote{color:#8a7661;font-size:.7rem;font-style:italic}
</style>
