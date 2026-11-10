<script setup lang="ts">
import { KeyRound, ShieldCheck, HeartHandshake } from '@lucide/vue'
import AdminResourceManager from '../../components/AdminResourceManager.vue'
definePageMeta({layout:'admin',middleware:'admin'})
const{data:session}=await useFetch<{role:string;user:{id:string}}>('/api/admin/session',{key:'admin-team-session'})
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

// Mode solo : rattacher SON compte à SA fiche praticienne. La fiche reste
// réservable par les clientes ; la liaison ouvre en plus l'agenda personnel
// /staff pour le compte connecté (gérante ou réception).
const myProfile=computed(()=>staffData.value?.items.find((item)=>item.userId===session.value?.user?.id)||null)
const linkableToMe=computed(()=>staffData.value?.items.filter((item)=>item.active&&!item.userId)||[])
const myLinkChoice=ref(''),linkBusy=ref(false),linkError=ref(''),linkOk=ref('')
async function linkMyProfile(){linkBusy.value=true;linkError.value='';linkOk.value=''
  try{const result=await $fetch<{guidance:string}>('/api/admin/staff-link',{method:'POST',body:{action:'link',staffId:myLinkChoice.value}});linkOk.value=result.guidance;myLinkChoice.value='';await refreshStaff()}
  catch(error){const data=(error as {data?:{statusMessage?:string;message?:string}})?.data;linkError.value=data?.statusMessage||data?.message||'Liaison impossible.'}finally{linkBusy.value=false}}
async function unlinkMyProfile(){linkBusy.value=true;linkError.value='';linkOk.value=''
  try{const result=await $fetch<{guidance:string}>('/api/admin/staff-link',{method:'POST',body:{action:'unlink'}});linkOk.value=result.guidance;await refreshStaff()}
  catch(error){const data=(error as {data?:{statusMessage?:string;message?:string}})?.data;linkError.value=data?.statusMessage||data?.message||'Déliason impossible.'}finally{linkBusy.value=false}}
</script>
<template><div>
<AdminResourceManager resource="staff" title="Équipe" description="Profils, services maîtrisés et disponibilités des professionnelles." :fields="fields" :columns="columns"/>
<section v-if="!isDevSession" class="admin-card access-card my-profile-card">
  <div class="admin-card__title"><h2><HeartHandshake :size="18"/> Votre fiche praticienne</h2></div>
  <p class="access-help">Vous pratiquez vous-même les poses&nbsp;? Liez votre compte à votre fiche&nbsp;: les clientes réservent avec vous, et votre agenda personnel devient disponible sur <strong>/staff</strong> (pratique sur téléphone). Délier ne supprime ni la fiche ni les rendez-vous.</p>
  <div class="my-profile-body">
    <template v-if="myProfile"><span class="my-profile-current">Fiche liée&nbsp;: <strong>{{myProfile.firstName}} {{myProfile.lastName||''}}</strong></span><button class="btn btn-secondary" type="button" :disabled="linkBusy" @click="unlinkMyProfile">{{linkBusy?'…':'Délier ma fiche'}}</button></template>
    <template v-else>
      <select v-model="myLinkChoice" class="form-control my-profile-select"><option value="" disabled>Choisir votre fiche praticienne</option><option v-for="profile in linkableToMe" :key="profile.id" :value="profile.id">{{profile.firstName}} {{profile.lastName||''}}</option></select>
      <button class="btn btn-primary" type="button" :disabled="linkBusy||!myLinkChoice" @click="linkMyProfile">{{linkBusy?'Liaison…':'C’est moi — lier cette fiche'}}</button>
    </template>
    <p v-if="linkOk" class="admin-success">{{linkOk}}</p>
    <p v-if="linkError" class="admin-alert">{{linkError}}</p>
  </div>
</section>

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
<style scoped>.access-card{margin-top:1.5rem}.access-count{display:flex;align-items:center;gap:.4rem;color:#877b73;font-size:.65rem}.access-help{padding:.9rem 1.15rem;color:#81756e;font-size:.7rem}.access-form{padding:.4rem 1.15rem 1.15rem}.access-actions{display:flex;align-items:center;gap:.8rem}.access-form .wide{grid-column:1/-1}.my-profile-body{display:flex;flex-wrap:wrap;align-items:center;gap:.7rem;padding:.9rem 1.15rem 1.15rem}.my-profile-current{font-size:.7rem;color:#4a403b}.my-profile-select{max-width:320px}.my-profile-body .admin-success,.my-profile-body .admin-alert{flex-basis:100%;margin:0;font-size:.66rem}</style>
