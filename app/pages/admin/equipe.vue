<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const{data:serviceData}=await useFetch<{items:Array<{id:string;name:string;active:boolean}>}>('/api/admin/manage',{query:{resource:'services'},key:'admin-staff-services'})
const serviceOptions=computed(()=>serviceData.value?.items.filter((item)=>item.active).map((item)=>({label:item.name,value:item.id}))||[])
const fields=computed(()=>[{key:'firstName',label:'Prénom',required:true},{key:'lastName',label:'Nom'},{key:'bio',label:'Biographie',type:'textarea' as const},{key:'imageUrl',label:'Photo (Cloudinary HTTPS ou /manus-storage/)'},{key:'serviceIds',label:'Prestations réalisables',type:'multiselect' as const,options:serviceOptions.value,help:'Sélectionnez les services que cette professionnelle maîtrise.'},{key:'active',label:'Active',type:'checkbox' as const,defaultValue:true}])
const columns=[{key:'firstName',label:'Prénom'},{key:'lastName',label:'Nom'},{key:'services',label:'Services'},{key:'active',label:'Active'}]
useSeoMeta({title:'Équipe — Administration',robots:'noindex,nofollow'})
</script>
<template><AdminResourceManager resource="staff" title="Équipe" description="Profils, services maîtrisés et disponibilités des professionnelles." :fields="fields" :columns="columns"/></template>
const fields=computed(()=>[{key:'firstName',label:'Prénom',required:true},{key:'lastName',label:'Nom'},{key:'bio',label:'Biographie',type:'textarea' as const},{key:'imageUrl',label:'Photo professionnelle',type:'image' as const},{key:'serviceIds',label:'Prestations réalisables',type:'multiselect' as const,options:serviceOptions.value,help:'Sélectionnez les services que cette professionnelle maîtrise.'},{key:'active',label:'Active',type:'checkbox' as const,defaultValue:true}])
