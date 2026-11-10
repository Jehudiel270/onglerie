<script setup lang="ts">
import { ArrowRight, MailCheck, ShieldCheck } from '@lucide/vue'
const route=useRoute(),code=ref(''),busy=ref(false),resending=ref(false),errorMessage=ref(''),info=ref(''),maskedEmail=ref('')
const returnTo=computed(()=>{const value=typeof route.query.redirect==='string'?route.query.redirect:'';return value.startsWith('/')&&!value.startsWith('//')?value:''})
async function resolveDestination(){const fallback=returnTo.value||'/mon-compte';try{await $fetch('/api/admin/session');return fallback.startsWith('/admin')?fallback:'/admin'}catch{/* pas du personnel admin */}try{await $fetch('/api/staff/session');return '/staff'}catch{/* pas membre de l'équipe */}return fallback}
onMounted(async()=>{
  try{
    const status=await $fetch<{authenticated:boolean;required:boolean;verified:boolean;maskedEmail:string}>('/api/auth-otp/status')
    if(!status.authenticated){await navigateTo('/connexion');return}
    maskedEmail.value=status.maskedEmail
    if(!status.required||status.verified)await navigateTo(await resolveDestination())
  }catch{await navigateTo('/connexion')}
})
async function verify(){
  busy.value=true;errorMessage.value=''
  try{await $fetch('/api/auth-otp/verify',{method:'POST',body:{code:code.value.trim()}});await navigateTo(await resolveDestination())}
  catch(error){const data=(error as {data?:{statusMessage?:string;message?:string}})?.data;errorMessage.value=data?.statusMessage||data?.message||'Code incorrect, expiré ou trop de tentatives. Demandez un nouveau code.'}
  finally{busy.value=false}
}
const resendIn=ref(0)
let timer:ReturnType<typeof setInterval>|null=null
function startCooldown(seconds:number){resendIn.value=seconds;if(timer)clearInterval(timer);timer=setInterval(()=>{resendIn.value=Math.max(0,resendIn.value-1);if(resendIn.value===0&&timer)clearInterval(timer)},1000)}
onBeforeUnmount(()=>{if(timer)clearInterval(timer)})
async function resend(){
  resending.value=true;errorMessage.value='';info.value=''
  try{await $fetch('/api/auth-otp/request',{method:'POST'});info.value='Nouveau code envoyé : vérifiez votre boîte e-mail (et les indésirables).';code.value='';startCooldown(60)}
  catch(error){const data=(error as {data?:{statusMessage?:string;message?:string}})?.data;errorMessage.value=data?.statusMessage||data?.message||'Envoi impossible pour le moment.'}
  finally{resending.value=false}
}
onMounted(()=>startCooldown(45))
useSeoMeta({title:'Vérification de connexion',robots:'noindex,nofollow'})
</script>
<template><div class="auth-page container-narrow"><div class="auth-card surface-card"><span class="eyebrow">Double vérification</span><h1 class="display">Un code vous attend par e-mail.</h1><p>Vos accès de gestion sont protégés par une seconde étape. Saisissez le code à six chiffres envoyé à <strong>{{maskedEmail||'votre adresse e-mail'}}</strong>. Il expire au bout de dix minutes.</p><form @submit.prevent="verify"><label class="form-field"><span>Code de vérification</span><input v-model="code" class="form-control otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="\d{6}" maxlength="6" required placeholder="000000"></label><button class="btn btn-primary" type="submit" :disabled="busy||code.trim().length!==6">{{busy?'Vérification…':'Confirmer'}} <ArrowRight :size="15"/></button><button class="btn btn-secondary" type="button" :disabled="resending||resendIn>0" @click="resend">{{resending?'Envoi…':resendIn>0?`Nouveau code dans ${resendIn} s`:'Renvoyer un code'}}</button><p v-if="info" class="auth-ok" role="status">{{info}}</p><p v-if="errorMessage" class="auth-error" role="alert">{{errorMessage}}</p></form><p class="auth-secure"><ShieldCheck :size="14"/> Code à usage unique, validé côté serveur ; cinq essais maximum.</p><p class="auth-help"><MailCheck :size="14"/> Sans accès à cette adresse e-mail, la connexion reste impossible : c'est voulu.</p></div></div></template>
<style scoped>.auth-page{padding:6rem 0}.auth-card{padding:clamp(1.5rem,5vw,3rem)}.auth-card h1{margin:.8rem 0;font-size:clamp(2.4rem,5vw,3.8rem)}.auth-card>p{max-width:500px;color:var(--muted);font-size:.8rem}.auth-card form{display:grid;gap:1rem;margin-top:1.5rem;max-width:420px}.form-field{display:grid;gap:.4rem}.form-field span{font-size:.72rem;font-weight:700}.otp-input{letter-spacing:.6rem;font-size:1.3rem;text-align:center;font-weight:700}.auth-error{color:#943d48;font-size:.76rem}.auth-ok{color:#32734e;font-size:.76rem}.auth-secure{display:flex;align-items:center;gap:.45rem;margin-top:1rem;font-size:.68rem}.auth-help{display:flex;align-items:center;gap:.45rem;margin-top:.4rem;color:#8a7d74;font-size:.66rem}</style>
