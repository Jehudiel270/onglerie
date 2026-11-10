<script setup lang="ts">
import { ArrowUpRight, Mail, MapPin, Phone, Send } from '@lucide/vue'
const {data:content}=await useFetch<{phone?:string;whatsapp?:string;email?:string;address?:string;city?:string;instagram?:string;openingHours?:Array<{day?:string;hours?:string}>;demo?:boolean;configured?:boolean}>('/api/public/content',{key:'salon-public-content'})
const form=reactive({name:'',phone:'',email:'',message:'',privacyAccepted:false,website:''})
const busy=ref(false),sent=ref(false),errorMessage=ref('')
const mapUrl=computed(()=>{const address=[content.value?.address,content.value?.city,'Bénin'].filter(Boolean).join(', ');return address?`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`:''})
async function submit(){errorMessage.value='';sent.value=false;busy.value=true;try{const result=await $fetch<{message:string}>('/api/contact',{method:'POST',body:{...form}});sent.value=true;errorMessage.value=result.message;Object.assign(form,{name:'',phone:'',email:'',message:'',privacyAccepted:false,website:''})}catch(error){errorMessage.value=error instanceof Error?error.message:'Le message n’a pas pu être enregistré.'}finally{busy.value=false}}
const title='Contact — Votre salon ongulaire au Bénin'
const description='Coordonnées, horaires, itinéraire et formulaire de contact du salon.'
useSeoMeta({title,description,ogTitle:title,ogDescription:description,ogType:'website',twitterCard:'summary'})
</script>

<template>
  <div>
    <PageIntro eyebrow="Nous joindre" title="Parlons de votre prochain rendez-vous." description="Retrouvez les coordonnées renseignées par le salon ou envoyez une question. Les informations non encore confirmées sont indiquées comme telles."/>
    <div class="container-page contact-grid">
      <aside class="contact-info"><span class="section-kicker">Le salon</span><h2 class="display">À votre écoute.</h2><div class="contact-items">
        <a v-if="content?.phone" :href="`tel:${content.phone.replace(/[^+\d]/g,'')}`"><Phone :size="17"/><span><small>Téléphone</small>{{content.phone}}</span><ArrowUpRight :size="14"/></a><div v-else><Phone :size="17"/><span><small>Téléphone</small>À renseigner par le salon</span></div>
        <a v-if="content?.email" :href="`mailto:${content.email}`"><Mail :size="17"/><span><small>E-mail</small>{{content.email}}</span><ArrowUpRight :size="14"/></a>
        <div v-if="content?.address||content?.city"><MapPin :size="17"/><span><small>Adresse</small>{{content.address}}<template v-if="content.city">, {{content.city}}</template></span><a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noreferrer" aria-label="Ouvrir l’itinéraire OpenStreetMap"><ArrowUpRight :size="14"/></a></div><div v-else><MapPin :size="17"/><span><small>Adresse</small>À renseigner par le salon</span></div>
        <a v-if="content?.whatsapp" :href="`https://wa.me/${content.whatsapp.replace(/\D/g,'')}`" target="_blank" rel="noreferrer"><span class="whatsapp-dot">W</span><span><small>WhatsApp</small>Ouvrir la conversation</span><ArrowUpRight :size="14"/></a>
      </div><div class="hours-box"><strong>Horaires</strong><template v-if="content?.openingHours?.length"><p v-for="row in content.openingHours" :key="row.day">{{row.day}} <span>{{row.hours}}</span></p></template><p v-else>Horaires à renseigner par le salon.</p></div>
      <div v-if="content?.demo" class="demo-note">Mode aperçu : les données sont des exemples et le formulaire ne persiste pas de message sans base réelle.</div></aside>
      <section v-reveal class="contact-form-wrap"><span class="section-kicker">Écrivez-nous</span><h2 class="display">Votre message.</h2>
        <form @submit.prevent="submit"><div class="form-row"><label class="form-field"><span>Nom complet</span><input v-model="form.name" class="form-control" name="name" autocomplete="name" required minlength="2" maxlength="120"></label><label class="form-field"><span>Téléphone (facultatif)</span><input v-model="form.phone" class="form-control" name="phone" type="tel" autocomplete="tel" placeholder="+229 …"></label></div>
          <label class="form-field"><span>E-mail (facultatif)</span><input v-model="form.email" class="form-control" name="email" type="email" autocomplete="email" maxlength="254"></label><label class="form-field"><span>Votre question</span><textarea v-model="form.message" class="form-control" name="message" rows="5" required minlength="15" maxlength="2000" placeholder="Dites-nous ce que vous souhaitez savoir…"/></label>
          <label class="website-field" aria-hidden="true">Site web<input v-model="form.website" tabindex="-1" autocomplete="off"></label>
          <label class="consent"><input v-model="form.privacyAccepted" type="checkbox" required><span>J’accepte que ces informations servent à traiter ma demande, conformément à la <NuxtLink to="/politique-confidentialite">politique de confidentialité</NuxtLink>.</span></label>
          <button class="btn btn-primary" type="submit" :disabled="busy||content?.demo||!form.privacyAccepted"><span>{{busy?'Enregistrement…':'Envoyer le message'}}</span><Send :size="15"/></button><p v-if="sent" class="form-feedback form-feedback--success" role="status">{{errorMessage}}</p><p v-else-if="errorMessage" class="form-feedback" role="alert">{{errorMessage}}</p>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.contact-grid{display:grid;grid-template-columns:.78fr 1.22fr;gap:clamp(2rem,7vw,7rem);padding-bottom:2rem}.contact-info h2,.contact-form-wrap h2{margin:.65rem 0 1.5rem;font-size:clamp(3rem,5vw,4.3rem)}.contact-items{display:grid;gap:.3rem}.contact-items>a,.contact-items>div{display:flex;min-height:64px;align-items:center;gap:.8rem;border-bottom:1px solid var(--line);color:var(--ink);font-size:.76rem}.contact-items>*>svg:first-child,.contact-items>a>svg:last-child,.contact-items>div>a{color:var(--merlot)}.contact-items span:not(.whatsapp-dot){display:grid;flex:1;gap:.1rem}.contact-items small{color:var(--muted);font-size:.59rem}.whatsapp-dot{display:grid;width:20px;height:20px;place-items:center;border:1px solid #438b65;border-radius:50%;color:#438b65;font-size:.58rem;font-weight:800}.hours-box{margin:1.7rem 0}.hours-box strong{display:block;margin-bottom:.6rem;font-family:var(--font-display);font-size:1.4rem}.hours-box p{display:flex;justify-content:space-between;gap:1rem;margin:.3rem 0;color:var(--muted);font-size:.68rem}.contact-form-wrap{border:1px solid rgba(107,45,69,.12);border-radius:1.3rem;padding:clamp(1.2rem,4vw,2.5rem);background:var(--paper)}.contact-form-wrap h2{margin-bottom:1.25rem}.contact-form-wrap form{display:grid;gap:1rem}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.form-field{display:grid;gap:.4rem}.form-field>span{color:#4c403c;font-size:.71rem;font-weight:700}.form-control{font-size:.78rem}.consent{display:flex;align-items:flex-start;gap:.6rem;color:var(--muted);font-size:.67rem}.consent input{margin-top:.2rem;accent-color:var(--merlot)}.consent a{color:var(--merlot);text-decoration:underline}.form-feedback{margin:0;color:#943d48;font-size:.75rem}.form-feedback--success{color:#2f674c}.website-field{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
@media(max-width:760px){.contact-grid{grid-template-columns:1fr}.form-row{grid-template-columns:1fr}}
</style>
