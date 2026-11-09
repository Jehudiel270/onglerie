<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const fields=[{key:'appointmentId',label:'ID du rendez-vous',required:true,help:'UUID consultable dans la fiche du rendez-vous.'},{key:'amountXof',label:'Montant réellement encaissé (XOF)',type:'number' as const,required:true},{key:'method',label:'Mode de réception',type:'select' as const,required:true,options:[{label:'Espèces',value:'cash'},{label:'Mobile Money',value:'mobile_money'},{label:'Virement',value:'bank_transfer'},{label:'Autre',value:'other'}]},{key:'reference',label:'Référence manuelle / reçu'}]
const columns=[{key:'reference',label:'Réservation'},{key:'customerName',label:'Cliente'},{key:'provider',label:'Fournisseur'},{key:'amountXof',label:'XOF'},{key:'method',label:'Mode'},{key:'status',label:'État'},{key:'reconciled',label:'Rapproché'},{key:'createdAt',label:'Enregistré'}]
useSeoMeta({title:'Paiements — Administration',robots:'noindex,nofollow'})
</script>
<template><AdminResourceManager resource="payments" title="Paiements" description="Seuls les montants réellement reçus et rapprochés alimentent les totaux encaissés. Un état paid_manual_review signifie qu’un paiement fournisseur a été reçu sans rendez-vous confirmé : contrôlez la référence dans FedaPay et contactez la cliente. Aucun remboursement automatique n’est exécuté." :fields="fields" :columns="columns"/></template>
