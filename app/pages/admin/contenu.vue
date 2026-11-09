<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const fields=[{key:'contentKey',label:'Section éditoriale',type:'select' as const,required:true,options:[{label:'Identité et réseaux — site',value:'site'},{label:'Accueil',value:'home'},{label:'À propos',value:'about'},{label:'FAQ',value:'faq'},{label:'Informations légales',value:'legal'},{label:'Réservation',value:'booking'}]},{key:'content',label:'Données JSON',type:'json' as const,required:true,help:'Les textes sont affichés comme texte, jamais injectés comme HTML. Voir docs/contenu.md pour la structure.'}]
const columns=[{key:'contentKey',label:'Section'},{key:'updatedAt',label:'Dernière modification'},{key:'content',label:'Aperçu JSON'}]
useSeoMeta({title:'Contenu — Administration',robots:'noindex,nofollow'})
</script>
<template><AdminResourceManager resource="content" title="Contenu du site" description="Contenus publics et FAQ administrables. Les coordonnées, avis, photos et faits restent sous contrôle de l’équipe." :fields="fields" :columns="columns" :deletable="false"/><section class="content-help"><h2 class="display">Contenus factuels</h2><p>Ne publiez qu’une adresse, un tarif, un avis, une certification ou une réalisation réellement fournis par votre salon. Les informations manquantes restent non renseignées. Pour les pages juridiques, faites valider le contenu par un professionnel local.</p></section></template>
<style scoped>.content-help{margin:1.6rem 0;padding:1rem 1.2rem;border:1px solid #e5dbd2;border-radius:.8rem;background:#fffdf9}.content-help h2{font-size:1.8rem}.content-help p{color:#81756e;font-size:.7rem;line-height:1.7}</style>
