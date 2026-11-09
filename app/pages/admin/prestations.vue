<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const{data:categoryData}=await useFetch<{items:Array<{id:string;name:string;kind:string;active:boolean}>}>('/api/admin/manage',{query:{resource:'categories'},key:'admin-service-categories'})
const categoryOptions=computed(()=>categoryData.value?.items.filter((item)=>item.kind==='service'&&item.active).map((item)=>({label:item.name,value:item.id}))||[])
const fields=computed(()=>[
 {key:'name',label:'Nom',required:true},{key:'slug',label:'Slug URL',required:true,help:'Lettres minuscules, chiffres et tirets.'},{key:'description',label:'Description visible',type:'textarea' as const,required:true},{key:'details',label:'Détails supplémentaires',type:'textarea' as const},{key:'categoryId',label:'Catégorie',type:'select' as const,nullable:true,options:categoryOptions.value},{key:'priceXof',label:'Prix total (XOF)',type:'number' as const,required:true,defaultValue:0},{key:'durationMinutes',label:'Durée (minutes)',type:'number' as const,required:true,defaultValue:45},{key:'preparationMinutes',label:'Temps de préparation (minutes)',type:'number' as const,defaultValue:0},{key:'depositXof',label:'Acompte demandé (XOF)',type:'number' as const,defaultValue:0},{key:'imageUrl',label:'Photo de la prestation',type:'image' as const},{key:'conditions',label:'Conditions et entretien',type:'textarea' as const},{key:'position',label:'Ordre d’affichage',type:'number' as const,defaultValue:0},{key:'featured',label:'À la une',type:'checkbox' as const},{key:'active',label:'Active / réservable',type:'checkbox' as const,defaultValue:true},
])
const columns=[{key:'name',label:'Prestation'},{key:'categoryName',label:'Catégorie'},{key:'priceXof',label:'Prix XOF'},{key:'durationMinutes',label:'Durée min'},{key:'depositXof',label:'Acompte XOF'},{key:'active',label:'Réservable'}]
useSeoMeta({title:'Prestations — Administration',robots:'noindex,nofollow'})
</script>
<template><AdminResourceManager resource="services" title="Prestations" description="Tarifs, durées, préparation, acomptes, images et statut de réservation. Les prix publiés sont ceux réellement configurés par l’équipe." :fields="fields" :columns="columns"/></template>
