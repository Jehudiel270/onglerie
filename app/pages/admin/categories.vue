<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const fields=[{key:'name',label:'Nom',required:true},{key:'slug',label:'Slug URL',required:true},{key:'kind',label:'Famille',type:'select' as const,required:true,options:[{label:'Prestation',value:'service'},{label:'Réalisations',value:'portfolio'}]},{key:'description',label:'Description',type:'textarea' as const},{key:'imageUrl',label:'Image (Cloudinary HTTPS ou /manus-storage/)'},{key:'position',label:'Ordre',type:'number' as const,defaultValue:0},{key:'active',label:'Active',type:'checkbox' as const,defaultValue:true}]
const columns=[{key:'name',label:'Catégorie'},{key:'kind',label:'Famille'},{key:'slug',label:'Slug'},{key:'position',label:'Ordre'},{key:'active',label:'Active'}]
useSeoMeta({title:'Catégories — Administration',robots:'noindex,nofollow'})
</script>
<template><AdminResourceManager resource="categories" title="Catégories" description="Organisez les prestations et réalisations avec des catégories distinctes." :fields="fields" :columns="columns"/></template>
const fields=[{key:'name',label:'Nom',required:true},{key:'slug',label:'Slug URL',required:true},{key:'kind',label:'Famille',type:'select' as const,required:true,options:[{label:'Prestation',value:'service'},{label:'Réalisations',value:'portfolio'}]},{key:'description',label:'Description',type:'textarea' as const},{key:'imageUrl',label:'Image',type:'image' as const},{key:'position',label:'Ordre',type:'number' as const,defaultValue:0},{key:'active',label:'Active',type:'checkbox' as const,defaultValue:true}]
