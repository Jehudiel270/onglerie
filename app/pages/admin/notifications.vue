<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const columns=[{key:'createdAt',label:'Créée'},{key:'channel',label:'Canal'},{key:'recipient',label:'Destinataire'},{key:'templateKey',label:'Modèle'},{key:'status',label:'État'},{key:'attempts',label:'Essais'},{key:'nextAttemptAt',label:'Prochaine tentative'},{key:'lastError',label:'Dernière erreur'}]
const fields:Array<{key:string;label:string}> = []
useSeoMeta({title:'Notifications — Administration',robots:'noindex,nofollow'})
</script>
<template><AdminResourceManager resource="notifications" title="Notifications" description="File transactionnelle et tentatives. Une notification en file ne signifie pas qu’elle a été remise." :fields="fields" :columns="columns" :creatable="false" :editable="false" :deletable="false"/><p class="provider-note">L’envoi e-mail nécessite un endpoint HTTP compatible et ses identifiants ; WhatsApp exige un numéro et un modèle approuvé. Une absence de fournisseur apparaît comme un échec réessayable.</p></template>
<style scoped>.provider-note{margin:1.2rem 0;color:#887c74;font-size:.7rem}</style>
