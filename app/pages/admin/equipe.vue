<script setup lang="ts">
import { KeyRound, ShieldCheck } from '@lucide/vue'
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const{data:session}=await useFetch<{role:string}>('/api/admin/session',{key:'admin-team-session'})
const isDevSession=computed(()=>session.value?.role==='dev')
const{data:serviceData}=await useFetch<{items:Array<{id:string;name:string;active:boolean}>}>('/api/admin/manage',{query:{resource:'services'},key:'admin-staff-services'})
const{data:staffData,refresh:refreshStaff}=await useFetch<{items:Array<{id:string;firstName:string;lastName:string|null;active:boolean;userId:string|null}>}>('/api/admin/manage',{query:{resource:'staff'},key:'admin-team-staff'})
const serviceOptions=computed(()=>serviceData.value?.items.filter((item)=>item.active).map((item)=>({label:item.name,value:item.id}))||[])
const fields=computed(()=>[{key:'firstName',label:'Prénom',required:true},{key:'lastName',label:'Nom'},{key:'bio',label:'Biographie',type:'textarea' as const},{key:'imageUrl',label:'Photo (Cloudinary HTTPS ou /manus-storage/)'},{key:'serviceIds',label:'Prestations réalisables',type:'multiselect' as const,options:serviceOptions.value,help:'Sélectionnez les services que cette professionnelle maîtrise.'},{key:'active',label:'Active',type:'checkbox' as const,defaultValue:true}])
const columns=[{key:'firstName',label:'Prénom'},{key:'lastName',label:'Nom'},{key:'services',label:'Services'},{key:'active',label:'Active'}]

const accountForm=reactive({staffId:'',email:'',password:'',role:'staff'})
const accountBusy=ref(false),accountError=ref(''),accountOk=ref('')
const linkableStaff=computed(()=>staffData.value?.items.filter((item)=>item.active&&!item.userId).map((item)=>({label:`${item.firstName} ${item.lastName||''}`.trim(),value:item.id}))||[])
const linkedStaff=computed(()=>staffData.value?.items.filter((item)=>item.userId).length||0)
async function createAccount(){
  accountBusy.value=true;accountError.value='';accountOk.value=''
  try{
    const result=await $fetch<{guidance:string}>('/api/admin/team-accounts',{method:'POST',body:{staffId:accountForm.staffId,email:accountForm.email.trim().toLowerCase(),password:accountForm.password,role:accountForm.role}})
    accountOk.value=result.guidance
    accountForm.staffId='';accountForm.email='';accountForm.password='';accountForm.role='staff'
    await refreshStaff()
  }catch(error){const data=(error as {data?:{message?:string;statusMessage?:string}})?.data;accountError.value=data?.message||data?.statusMessage||'Création impossible.'}finally{accountBusy.value=false}
}
useSeoMeta({title:'Équipe — Administration',robots:'noindex,nofollow'})
</script>
<template><div>
<AdminResourceManager resource="staff" title="Équipe" description="Profils, services maîtrisés et disponibilités des professionnelles." :fields="fields" :columns="columns"/>
<section class="admin-card access-card">
  <div class="admin-card__title"><h2><KeyRound :size="18"/> Accès à l’espace équipe</h2><span class="access-count"><ShieldCheck :size="14"/> {{linkedStaff}} compte(s) rattaché(s)</span></div>
  <p class="access-help">Créez le compte de connexion d’une employée ou d’une réceptionniste. Rôle <strong>Réception</strong> : agenda, clientes, paiements, messages (sans tarifs ni paramètres). Rôle <strong>Employé·e</strong> : agenda personnel sur /staff. Communiquez le mot de passe initial par un canal privé et demandez sa modification.</p>
  <form class="admin-form-grid access-form" @submit.prevent="createAccount">
    <label class="form-field"><span>Fiche employée *</span><select v-model="accountForm.staffId" class="form-control" required><option value="" disabled>Choisir une fiche sans accès</option><option v-for="option in linkableStaff" :key="option.value" :value="option.value">{{option.label}}</option></select></label>
    <label class="form-field"><span>Rôle *</span><select v-model="accountForm.role" class="form-control"><option value="staff">Employé·e — agenda personnel</option><option value="reception">Réception — quotidien du salon</option><option v-if="isDevSession" value="owner">Propriétaire — réservé au développeur</option></select></label>
    <label class="form-field"><span>E-mail de connexion *</span><input v-model="accountForm.email" type="email" class="form-control" required maxlength="254" autocomplete="off"></label>
    <label class="form-field"><span>Mot de passe initial * (8 caractères minimum, 14 recommandés)</span><input v-model="accountForm.password" type="password" class="form-control" required minlength="8" maxlength="72" autocomplete="new-password"></label>
    <div class="wide access-actions"><button class="btn btn-primary" type="submit" :disabled="accountBusy||!accountForm.staffId">{{accountBusy?'Création…':'Créer l’accès'}}</button></div>
    <p v-if="accountOk" class="admin-success wide">{{accountOk}}</p>
    <p v-if="accountError" class="admin-alert wide">{{accountError}}</p>
  </form>
</section>
</div></template>
<style scoped>.access-card{margin-top:1.5rem}.access-count{display:flex;align-items:center;gap:.4rem;color:#877b73;font-size:.65rem}.access-help{padding:.9rem 1.15rem;color:#81756e;font-size:.7rem}.access-form{padding:.4rem 1.15rem 1.15rem}.access-actions{display:flex;align-items:center;gap:.8rem}.access-form .wide{grid-column:1/-1}</style>
