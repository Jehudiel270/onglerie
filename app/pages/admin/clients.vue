<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const fields=[{key:'adminNote',label:'Note interne non sensible',type:'textarea' as const,help:'Ne stockez ni données de santé ni informations de carte bancaire.'}]
const columns=[{key:'firstName',label:'Prénom'},{key:'lastName',label:'Nom'},{key:'phone',label:'Téléphone'},{key:'email',label:'E-mail'},{key:'visitCount',label:'Visites terminées'},{key:'lastVisit',label:'Dernière visite'},{key:'paidTotalXof',label:'Total encaissé XOF'},{key:'adminNote',label:'Note'}]
useSeoMeta({title:'Clientes — Administration',robots:'noindex,nofollow'})
</script>
<template><AdminResourceManager resource="customers" title="Clientes" description="Historique et dépenses rapprochées — jamais le montant simplement réservé." :fields="fields" :columns="columns" searchable :creatable="false" :editable="true" :deletable="false"/></template>
