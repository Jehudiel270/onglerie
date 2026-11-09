<script setup lang="ts">
import { AlertCircle, Check, Pencil, Plus, RefreshCw, Save, Trash2, X } from '@lucide/vue'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { SALON_TIMEZONE } from '~~/shared/constants/business'

type Resource = 'services'|'categories'|'portfolio'|'staff'|'schedules'|'exceptions'|'customers'|'payments'|'notifications'|'content'|'settings'|'salon'|'contacts'
type Field = {key:string;label:string;type?:'text'|'textarea'|'number'|'checkbox'|'select'|'multiselect'|'list'|'images'|'image'|'json'|'datetime'|'time';required?:boolean;nullable?:boolean;numeric?:boolean;numericList?:boolean;defaultValue?:string|number|boolean;help?:string;options?:Array<{label:string;value:string}>}
type Column = {key:string;label:string}
const props = withDefaults(defineProps<{resource:Resource;title:string;description:string;fields:Field[];columns:Column[];searchable?:boolean;creatable?:boolean;editable?:boolean;deletable?:boolean}>(),{searchable:false,creatable:true,editable:true,deletable:true})
const items=ref<Array<Record<string,unknown>>>([]),loading=ref(false),showForm=ref(false),editingId=ref(''),search=ref(''),errorMessage=ref(''),successMessage=ref('')
const form=reactive<Record<string,string|number|boolean>>({})
function setDefaults(item?:Record<string,unknown>){
  for(const field of props.fields){const current=item?.[field.key];let value:unknown=current??field.defaultValue??''
    if(field.type==='checkbox')value=Boolean(value)
    else if((field.type==='list'||field.type==='multiselect'||field.type==='images')&&Array.isArray(value))value=value.join(', ')
    else if(field.type==='json'&&typeof value==='object'&&value!==null)value=JSON.stringify(value,null,2)
    else if(field.type==='datetime'&&value)value=formatInTimeZone(new Date(String(value)),SALON_TIMEZONE,"yyyy-MM-dd'T'HH:mm")
    form[field.key]=value as string|number|boolean
  }
}
async function load(){loading.value=true;errorMessage.value='';try{const result=await $fetch<{items?:Array<Record<string,unknown>>}>('/api/admin/manage',{query:{resource:props.resource,...(props.searchable&&search.value?{q:search.value}:{})}});items.value=result.items||[]}catch(error){errorMessage.value=(error as{data?:{statusMessage?:string}})?.data?.statusMessage||'Les données ne peuvent pas être chargées.'}finally{loading.value=false}}
watch(()=>[props.resource,search.value],load,{immediate:true})
function add(){editingId.value='';setDefaults();showForm.value=true;errorMessage.value='';successMessage.value=''}
function edit(item:Record<string,unknown>){editingId.value=String(item.id||'');setDefaults(item);showForm.value=true;errorMessage.value='';successMessage.value=''}
function cancel(){showForm.value=false;editingId.value=''}
function updateMulti(key:string,event:Event){const select=event.target as HTMLSelectElement;form[key]=Array.from(select.selectedOptions).map((option)=>option.value).join(', ')}
function valueFor(field:Field):unknown{
  const raw=form[field.key]
  if(field.type==='checkbox')return Boolean(raw)
  if(field.type==='number'||field.numeric)return raw===''?undefined:Number(raw)
  if(field.type==='list'||field.type==='multiselect'||field.type==='images'){const values=String(raw||'').split(',').map((item)=>item.trim()).filter(Boolean);return field.numericList?values.map(Number):values}
  if(field.type==='json'){try{return JSON.parse(String(raw||'{}'))}catch{throw new Error(`Le champ « ${field.label} » doit être un JSON valide.`)}}
  if(field.type==='datetime'&&raw)return fromZonedTime(String(raw),SALON_TIMEZONE).toISOString()
  if(field.nullable&&raw==='')return null
  return raw
}
async function save(){errorMessage.value='';successMessage.value='';const payload:Record<string,unknown>={};try{for(const field of props.fields){const value=valueFor(field);if(value!==undefined)payload[field.key]=value}}catch(error){errorMessage.value=error instanceof Error?error.message:'Valeur invalide.';return}loading.value=true;try{if(editingId.value)await $fetch(`/api/admin/manage/${encodeURIComponent(editingId.value)}`,{method:'PATCH',body:{resource:props.resource,data:payload}});else await $fetch('/api/admin/manage',{method:'POST',body:{resource:props.resource,data:payload}});showForm.value=false;editingId.value='';successMessage.value='Modifications enregistrées.';await load()}catch(error){errorMessage.value=(error as{data?:{statusMessage?:string}})?.data?.statusMessage||'L’enregistrement a échoué.'}finally{loading.value=false}}
async function remove(item:Record<string,unknown>){if(!window.confirm('Confirmer cette action ? Les ressources liées aux rendez-vous seront conservées ou désactivées.'))return;errorMessage.value='';try{await $fetch(`/api/admin/manage/${encodeURIComponent(String(item.id))}`,{method:'DELETE',query:{resource:props.resource}});successMessage.value='Action enregistrée.';await load()}catch(error){errorMessage.value=(error as{data?:{statusMessage?:string}})?.data?.statusMessage||'Cette action n’a pas été exécutée.'}}
async function retry(item:Record<string,unknown>){try{await $fetch(`/api/admin/manage/${encodeURIComponent(String(item.id))}`,{method:'PATCH',body:{resource:'notifications',data:{action:'retry'}}});successMessage.value='Notification remise en file.';await load()}catch(error){errorMessage.value=(error as{data?:{statusMessage?:string}})?.data?.statusMessage||'La notification ne peut pas être relancée.'}}
function display(item:Record<string,unknown>,key:string){const value=item[key];if(value===null||value===undefined||value==='')return'—';if(typeof value==='boolean')return value?'Oui':'Non';if(Array.isArray(value))return value.map((part)=>typeof part==='object'&&part!==null?'name'in part?String((part as{name:string}).name):JSON.stringify(part):String(part)).join(', ')||'—';if(typeof value==='object')return JSON.stringify(value);return String(value)}
</script>
<template>
  <section class="resource-manager">
    <div class="admin-page-head"><div><span class="section-kicker">Gestion du salon</span><h1>{{title}}.</h1><p>{{description}}</p></div><div class="manager-controls"><button class="admin-inline-action" :disabled="loading" @click="load"><RefreshCw :size="13"/> Actualiser</button><button v-if="creatable" class="btn btn-primary" @click="add"><Plus :size="15"/> Ajouter</button></div></div>
    <p v-if="errorMessage" class="admin-alert" role="alert"><AlertCircle :size="15"/> {{errorMessage}}</p><p v-if="successMessage" class="admin-success" role="status">{{successMessage}}</p>
    <div v-if="searchable" class="admin-toolbar"><input v-model="search" class="form-control" placeholder="Rechercher…" aria-label="Rechercher"></div>
    <section v-if="showForm" class="admin-card editor-card"><div class="admin-card__title"><h2>{{editingId?'Modifier':'Ajouter'}} — {{title.toLowerCase()}}</h2><button class="admin-inline-action" type="button" @click="cancel"><X :size="14"/> Fermer</button></div><form class="admin-form-grid" @submit.prevent="save">
      <label v-for="field in fields" :key="field.key" :class="['form-field',{'wide':['textarea','json','list','images','multiselect'].includes(field.type||'')}]"><span>{{field.label}} <small v-if="field.required">*</small></span>
        <textarea v-if="field.type==='textarea'||field.type==='json'||field.type==='list'" v-model="form[field.key]" class="form-control" :required="field.required" :rows="field.type==='json'?7:field.type==='list'?3:4" :placeholder="field.type==='json'?'{}':field.type==='list'?'Séparez par des virgules…':''"/>
        <CloudinaryUploader v-else-if="field.type==='image'||field.type==='images'" v-model="form[field.key]" :multiple="field.type==='images'"/>
        <select v-else-if="field.type==='multiselect'" multiple class="form-control multi-select" :value="String(form[field.key]||'').split(',').map((value)=>value.trim()).filter(Boolean)" @change="updateMulti(field.key,$event)"><option v-for="option in field.options||[]" :key="option.value" :value="option.value">{{option.label}}</option></select>
        <select v-else-if="field.type==='select'" v-model="form[field.key]" class="form-control" :required="field.required"><option value="">Sélectionner…</option><option v-for="option in field.options||[]" :key="option.value" :value="option.value">{{option.label}}</option></select>
        <input v-else-if="field.type==='checkbox'" v-model="form[field.key]" type="checkbox" class="check-control">
        <input v-else v-model="form[field.key]" class="form-control" :type="field.type==='datetime'?'datetime-local':field.type==='time'?'time':field.type||'text'" :required="field.required" :min="field.type==='number'?'0':undefined" :step="field.type==='number'?'1':undefined">
        <small v-if="field.help" class="field-help">{{field.help}}</small>
      </label>
      <div class="editor-actions"><button class="btn btn-primary" type="submit" :disabled="loading"><Save :size="15"/> {{loading?'Enregistrement…':'Enregistrer'}}</button><button class="admin-inline-action" type="button" @click="cancel"><X :size="14"/> Annuler</button></div>
    </form></section>
    <section class="admin-card"><div class="admin-card__title"><h2>{{items.length}} élément{{items.length>1?'s':''}}</h2><span v-if="loading" class="loading-label">Chargement…</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr v-if="items.length"><th v-for="column in columns" :key="column.key">{{column.label}}</th><th v-if="editable||deletable||resource==='notifications'">Actions</th></tr></thead><tbody><tr v-for="item in items" :key="String(item.id||item.contentKey||item.weekday||item.name)"><td v-for="column in columns" :key="column.key"><strong v-if="column===columns[0]">{{display(item,column.key)}}</strong><template v-else>{{display(item,column.key)}}</template></td><td v-if="editable||deletable||resource==='notifications'"><div class="admin-actions"><button v-if="resource==='notifications'&&['failed','retry'].includes(String(item.status))" @click="retry(item)"><RefreshCw :size="12"/> Relancer</button><button v-else-if="editable" @click="edit(item)"><Pencil :size="12"/> Modifier</button><button v-if="deletable" @click="remove(item)"><Trash2 :size="12"/> Désactiver</button></div></td></tr><tr v-if="!loading&&!items.length"><td :colspan="columns.length+1" class="admin-empty">Aucune donnée persistée à afficher.</td></tr></tbody></table></div><p v-if="resource==='notifications'" class="resource-note"><Check :size="13"/> La relance remet une tâche en file ; seule une exécution réussie du fournisseur la marque envoyée.</p></section>
  </section>
</template>
<style scoped>.resource-manager{display:grid;gap:.8rem}.manager-controls{display:flex;flex-wrap:wrap;gap:.5rem}.editor-card{margin-bottom:.3rem}.editor-card .admin-form-grid{padding:1.2rem}.form-field{display:grid;align-content:start;gap:.35rem}.form-field>span{color:#554943;font-size:.66rem;font-weight:700}.form-field>span small{color:#a1444d}.field-help,.loading-label{color:#8b7e76;font-size:.59rem}.check-control{width:20px;height:20px;accent-color:#6b2d45}.multi-select{min-height:9rem}.editor-actions{display:flex;grid-column:1/-1;gap:.5rem}.resource-note{display:flex;align-items:center;gap:.35rem;margin:.4rem .8rem .8rem;color:#887c74;font-size:.6rem}.admin-alert,.admin-success{display:flex;align-items:center;gap:.4rem}@media(max-width:700px){.manager-controls{width:100%}}</style>
