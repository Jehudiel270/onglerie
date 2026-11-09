<script setup lang="ts">
import { ArrowRight, CalendarDays, Eye, Plus, RefreshCw, X } from '@lucide/vue'
import { SALON_TIMEZONE, formatXof } from '~~/shared/constants/business'
import type { PublicCatalog } from '~~/shared/types/catalog'
definePageMeta({ layout: 'admin', middleware: 'admin' })

type Row = { id: string; reference: string; status: string; startsAt: string; endsAt: string; customer: { name: string; phone: string; email: string | null }; staffName: string; services: string[]; totalXof: number; depositDueXof: number; amountPaidXof: number; remainingXof: number }
type Slot = { startsAt: string; endsAt: string; staffId: string; staffName: string }
type Detail = { id: string; reference: string; status: string; startsAt: string; endsAt: string; expiresAt: string | null; customer: { name: string; phone: string; whatsapp: string | null; email: string | null }; staffName: string; services: Array<{ name: string; priceXof: number; durationMinutes: number }>; totalXof: number; depositDueXof: number; amountPaidXof: number; remainingXof: number; note: string | null; payments: Array<{ id: string; provider: string; reference: string | null; amountXof: number; currency: string; method: string | null; status: string; reconciled: boolean; paidAt: string | null }>; history: Array<{ fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string }> }

const { data: catalog } = await useFetch<PublicCatalog>('/api/public/catalog', { key: 'admin-reservation-catalog' })
const status = ref(''), search = ref(''), items = ref<Row[]>([]), busy = ref(false), errorMessage = ref(''), successMessage = ref(''), showCreate = ref(false), creating = ref(false), availabilityLoading = ref(false), configured = ref(false), slots = ref<Slot[]>([]), selectedIds = ref<string[]>([]), selectedStaff = ref(''), selectedSlot = ref<Slot | null>(null), detail = ref<Detail | null>(null), detailLoading = ref(false)
function todayLocal() { return new Intl.DateTimeFormat('en-CA', { timeZone: SALON_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
const chosenDate = ref(todayLocal())
const createForm = reactive({ firstName: '', lastName: '', phone: '', whatsapp: '', email: '', note: '', reason: 'Coordonné avec la cliente.' })
const activeServices = computed(() => catalog.value?.services ?? [])
const availableStaff = computed(() => { const seen = new Map<string, string>(); for (const slot of slots.value) seen.set(slot.staffId, slot.staffName); return [...seen].map(([id, name]) => ({ id, name })) })
const visibleSlots = computed(() => slots.value.filter((item) => !selectedStaff.value || item.staffId === selectedStaff.value))

async function load() {
  busy.value = true; errorMessage.value = ''
  try { const result = await $fetch<{ appointments: Row[] }>('/api/admin/appointments', { query: { ...(status.value ? { status: status.value } : {}), ...(search.value ? { q: search.value } : {}) } }); items.value = result.appointments }
  catch (error) { errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Les rendez-vous ne peuvent pas être chargés.' }
  finally { busy.value = false }
}
watch([status, search], load, { immediate: true })
watch([() => selectedIds.value.join(','), chosenDate], async () => {
  selectedSlot.value = null; slots.value = []; selectedStaff.value = ''; configured.value = false
  if (!showCreate.value || !selectedIds.value.length) return
  availabilityLoading.value = true
  try { const result = await $fetch<{ configured: boolean; slots: Slot[] }>('/api/public/availability', { query: { date: chosenDate.value, services: selectedIds.value.slice().sort().join(',') } }); configured.value = result.configured; slots.value = result.slots }
  catch (error) { errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Le calendrier réel ne peut pas être chargé.' }
  finally { availabilityLoading.value = false }
})
watch(selectedStaff, () => { if (selectedSlot.value && !visibleSlots.value.some((slot) => slot.startsAt === selectedSlot.value?.startsAt && slot.staffId === selectedSlot.value?.staffId)) selectedSlot.value = null })
function localDate(value: string) { return new Intl.DateTimeFormat('fr-BJ', { timeZone: SALON_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function localTime(value: string) { return new Intl.DateTimeFormat('fr-BJ', { timeZone: SALON_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function toggleService(id: string) { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter((item) => item !== id) : [...selectedIds.value, id] }
function openCreate() { errorMessage.value = ''; successMessage.value = ''; showCreate.value = true; createForm.firstName = ''; createForm.lastName = ''; createForm.phone = ''; createForm.whatsapp = ''; createForm.email = ''; createForm.note = ''; createForm.reason = 'Coordonné avec la cliente.'; selectedIds.value = []; selectedSlot.value = null; configured.value = false }
async function createAppointment() {
  if (!selectedSlot.value) { errorMessage.value = 'Sélectionnez un créneau réellement disponible.'; return }
  creating.value = true; errorMessage.value = ''
  try {
    const result = await $fetch<{ ok: boolean; message: string }>('/api/admin/appointments', { method: 'POST', body: { serviceIds: selectedIds.value, staffId: selectedSlot.value.staffId, startsAt: selectedSlot.value.startsAt, firstName: createForm.firstName, lastName: createForm.lastName, phone: createForm.phone, whatsapp: createForm.whatsapp || '', email: createForm.email || '', note: createForm.note, idempotencyKey: crypto.randomUUID(), reason: createForm.reason } })
    showCreate.value = false; successMessage.value = result.message; await load()
  } catch (error) { errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Le rendez-vous n’a pas été créé.'; selectedSlot.value = null }
  finally { creating.value = false }
}
async function update(row: Row, next: string) {
  const reason = window.prompt(next === 'cancelled' && row.amountPaidXof > 0 ? 'Note requise pour traiter les sommes déjà encaissées (aucun remboursement automatique n’est fait).' : 'Note d’historique (facultative)') || ''
  if (next === 'cancelled' && row.amountPaidXof > 0 && reason.trim().length < 4) { errorMessage.value = 'Une note de traitement d’au moins quatre caractères est requise.'; return }
  try { await $fetch(`/api/admin/appointments/${row.id}`, { method: 'PATCH', body: { status: next, ...(reason ? { reason } : {}) } }); successMessage.value = 'Le rendez-vous a été mis à jour.'; await load(); if (detail.value?.id === row.id) await loadDetail(row.id) }
  catch (error) { errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Cette action n’a pas été exécutée.' }
}
async function reschedule(row: Row) {
  const value = window.prompt('Nouvelle date et heure ISO avec décalage horaire (ex. 2026-11-06T14:30:00+01:00)')
  if (!value) return
  try { await $fetch(`/api/admin/appointments/${row.id}`, { method: 'PATCH', body: { startsAt: new Date(value).toISOString(), reason: 'Report convenu avec la cliente.' } }); successMessage.value = 'Créneau déplacé après vérification des horaires.'; await load() }
  catch (error) { errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Ce nouveau créneau est indisponible.' }
}
async function loadDetail(id: string) {
  detailLoading.value = true
  try { const result = await $fetch<{ appointment: Detail }>(`/api/admin/appointments/${id}`); detail.value = result.appointment }
  catch (error) { errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || 'La fiche de rendez-vous ne peut pas être affichée.' }
  finally { detailLoading.value = false }
}
useSeoMeta({ title: 'Rendez-vous — Administration', robots: 'noindex,nofollow' })
</script>
<template>
  <div class="appointments-page">
    <div class="admin-page-head"><div><span class="section-kicker">Opérations</span><h1>Rendez-vous.</h1><p>Les changements sont horodatés; les encaissements ne sont comptés qu’après rapprochement.</p></div><div class="page-actions"><button class="admin-inline-action" :disabled="busy" @click="load"><RefreshCw :size="13"/> Actualiser</button><button class="btn btn-primary" @click="openCreate"><Plus :size="15"/> Nouveau rendez-vous</button></div></div>
    <p v-if="errorMessage" class="admin-alert" role="alert">{{errorMessage}}</p><p v-if="successMessage" class="admin-success" role="status">{{successMessage}}</p>
    <section v-if="showCreate" class="admin-card create-card"><div class="admin-card__title"><div><span class="section-kicker">Création manuelle</span><h2>Planifier un rendez-vous confirmé par l’équipe.</h2></div><button class="admin-inline-action" @click="showCreate=false"><X :size="13"/> Fermer</button></div>
      <form class="creation-form" @submit.prevent="createAppointment">
        <div class="service-picks"><label v-for="service in activeServices" :key="service.id" :class="['service-pick', { selected: selectedIds.includes(service.id) }]"><input type="checkbox" :checked="selectedIds.includes(service.id)" @change="toggleService(service.id)"><span><strong>{{service.name}}</strong><small>{{formatXof(service.priceXof)}} · {{service.durationMinutes}} min</small></span></label></div>
        <div class="form-row"><label class="form-field"><span>Date locale</span><input v-model="chosenDate" class="form-control" type="date" :min="todayLocal()" :disabled="!selectedIds.length" required></label><label class="form-field"><span>Professionnelle disponible</span><select v-model="selectedStaff" class="form-control" :disabled="!availableStaff.length"><option value="">Toutes les professionnelles</option><option v-for="person in availableStaff" :key="person.id" :value="person.id">{{person.name}}</option></select></label></div>
        <p v-if="availabilityLoading" class="empty-state">Recherche des créneaux du salon…</p><p v-else-if="selectedIds.length&&!configured" class="empty-state">Aucun horaire n’est configuré pour cette date et cette sélection.</p>
        <div v-else-if="visibleSlots.length" class="slot-picks"><button v-for="slot in visibleSlots" :key="`${slot.staffId}:${slot.startsAt}`" type="button" :class="['slot-pick', { selected: selectedSlot?.startsAt === slot.startsAt && selectedSlot?.staffId === slot.staffId }]" @click="selectedSlot=slot"><CalendarDays :size="13"/>{{localTime(slot.startsAt)}}<small>{{slot.staffName}}</small></button></div>
        <div class="form-row"><label class="form-field"><span>Prénom cliente *</span><input v-model="createForm.firstName" class="form-control" required maxlength="80"></label><label class="form-field"><span>Nom *</span><input v-model="createForm.lastName" class="form-control" required maxlength="80"></label></div>
        <label class="form-field"><span>Téléphone béninois *</span><input v-model="createForm.phone" class="form-control" type="tel" placeholder="+229 …" required></label>
        <div class="form-row"><label class="form-field"><span>WhatsApp (facultatif)</span><input v-model="createForm.whatsapp" class="form-control" type="tel"></label><label class="form-field"><span>E-mail (facultatif)</span><input v-model="createForm.email" class="form-control" type="email"></label></div>
        <label class="form-field"><span>Note pour l’équipe</span><textarea v-model="createForm.note" class="form-control" maxlength="800" rows="2"/></label><label class="form-field"><span>Raison de la confirmation manuelle *</span><input v-model="createForm.reason" class="form-control" required minlength="4" maxlength="500"></label>
        <p class="manual-note">La création confirme le rendez-vous après vérification par le membre de l’équipe. Elle ne crée aucun paiement : l’acompte dû et les sommes encaissées restent distincts dans le dossier.</p><button class="btn btn-primary" :disabled="creating||!selectedSlot||!selectedIds.length">{{creating?'Enregistrement…':'Créer le rendez-vous confirmé'}}</button>
      </form>
    </section>
    <div class="admin-toolbar"><input v-model="search" class="form-control" placeholder="Référence, cliente, téléphone" aria-label="Rechercher un rendez-vous"><select v-model="status" class="form-control" aria-label="Filtrer par statut"><option value="">Tous les statuts</option><option value="confirmed">Confirmé</option><option value="pending_payment">En attente d’acompte</option><option value="cancelled">Annulé</option><option value="completed">Terminé</option><option value="no_show">Absence</option><option value="expired,payment_failed">Expiré ou paiement échoué</option></select></div>
    <section class="admin-card"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Cliente</th><th>Rendez-vous</th><th>Équipe</th><th>État</th><th>Montant / encaissement</th><th>Actions</th></tr></thead><tbody><tr v-for="row in items" :key="row.id"><td><strong>{{row.customer.name}}</strong><small>{{row.customer.phone}}</small><small>{{row.customer.email}}</small></td><td><button class="reference-link" @click="loadDetail(row.id)"><strong>{{row.reference}}</strong> <Eye :size="12"/></button><small>{{localDate(row.startsAt)}} · {{row.services.join(' · ')}}</small></td><td>{{row.staffName||'Non attribuée'}}</td><td><span class="status-pill">{{row.status}}</span></td><td><strong>{{formatXof(row.totalXof)}}</strong><small>Dû {{formatXof(row.depositDueXof)}} · payé {{formatXof(row.amountPaidXof)}} · solde {{formatXof(row.remainingXof)}}</small></td><td><div class="admin-actions"><button v-if="row.status==='pending_payment'&&row.amountPaidXof>=row.depositDueXof" @click="update(row,'confirmed')">Confirmer</button><button v-if="row.status==='confirmed'" @click="update(row,'completed')">Terminer</button><button v-if="row.status==='confirmed'" @click="update(row,'no_show')">Absence</button><button v-if="['confirmed','pending_payment'].includes(row.status)" @click="reschedule(row)">Reporter</button><button v-if="['confirmed','pending_payment'].includes(row.status)" @click="update(row,'cancelled')">Annuler</button><NuxtLink class="admin-inline-action" to="/admin/paiements">Paiements <ArrowRight :size="12"/></NuxtLink></div></td></tr><tr v-if="!busy&&!items.length"><td colspan="6" class="admin-empty">Aucun rendez-vous correspondant aux filtres.</td></tr><tr v-if="busy"><td colspan="6" class="admin-empty">Chargement…</td></tr></tbody></table></div></section>
    <div v-if="detail||detailLoading" class="detail-overlay" role="presentation" @click.self="detail=null"><section class="admin-card detail-panel" role="dialog" aria-modal="true" aria-label="Détail du rendez-vous"><div class="admin-card__title"><h2>{{detail?.reference||'Chargement…'}}</h2><button class="admin-inline-action" @click="detail=null"><X :size="13"/> Fermer</button></div><p v-if="detailLoading">Chargement de la fiche…</p><template v-else-if="detail"><div class="detail-grid"><p><span>Statut</span><strong>{{detail.status}}</strong></p><p><span>Date</span><strong>{{localDate(detail.startsAt)}}</strong></p><p><span>Cliente</span><strong>{{detail.customer.name}}<br>{{detail.customer.phone}}<br>{{detail.customer.email||'Sans e-mail'}}</strong></p><p><span>Équipe</span><strong>{{detail.staffName||'Non attribuée'}}</strong></p><p class="detail-wide"><span>Prestations</span><strong v-for="service in detail.services" :key="service.name">{{service.name}} — {{formatXof(service.priceXof)}} — {{service.durationMinutes}} min</strong></p><p><span>Total / acompte dû</span><strong>{{formatXof(detail.totalXof)}} / {{formatXof(detail.depositDueXof)}}</strong></p><p><span>Encaissé / solde</span><strong>{{formatXof(detail.amountPaidXof)}} / {{formatXof(detail.remainingXof)}}</strong></p><p class="detail-wide"><span>Note cliente</span><strong>{{detail.note||'—'}}</strong></p></div><h3>Paiements</h3><p v-for="payment in detail.payments" :key="payment.id" class="history-line">{{payment.provider}} · {{formatXof(payment.amountXof)}} {{payment.currency}} · {{payment.status}} · {{payment.reconciled?'rapproché':'non rapproché'}} · {{payment.reference||'sans référence'}}</p><h3>Historique</h3><p v-for="entry in detail.history" :key="entry.createdAt" class="history-line">{{localDate(entry.createdAt)}} · {{entry.fromStatus||'nouveau'}} → {{entry.toStatus}} · {{entry.reason||'—'}}</p></template></section></div>
  </div>
</template>
<style scoped>
.appointments-page{display:grid;gap:.8rem}.page-actions{display:flex;gap:.55rem;flex-wrap:wrap}.create-card{margin-bottom:1rem}.create-card>.admin-card__title h2{margin:.15rem 0;font-size:1.45rem}.creation-form{display:grid;gap:.85rem;padding:1rem}.service-picks{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.45rem}.service-pick{display:flex;align-items:center;gap:.45rem;border:1px solid #e2d8ce;border-radius:.7rem;padding:.6rem;cursor:pointer}.service-pick.selected,.slot-pick.selected{border-color:#693047;background:#f9eff0}.service-pick span{display:grid;gap:.15rem}.service-pick strong{font-size:.7rem}.service-pick small,.manual-note{color:#847870;font-size:.61rem}.slot-picks{display:flex;gap:.4rem;flex-wrap:wrap}.slot-pick{display:flex;align-items:center;gap:.3rem;border:1px solid #e2d8ce;border-radius:999px;padding:.45rem .7rem;background:#fff;font-size:.65rem;cursor:pointer}.slot-pick small{color:#847870}.manual-note{padding:.65rem;border-left:2px solid #9d697b;background:#fcf8f4}.reference-link{display:flex;align-items:center;gap:.2rem;border:0;background:none;color:#693047;cursor:pointer}.detail-overlay{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:1rem;background:#261c1ccc}.detail-panel{width:min(100%,720px);max-height:min(90vh,860px);overflow:auto;padding:1rem}.detail-panel h3{margin:1.2rem 0 .4rem;font-family:var(--font-body);font-size:.76rem}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem}.detail-grid p{display:grid;gap:.22rem;margin:0;padding:.55rem;border-radius:.5rem;background:#faf5ef;font-size:.64rem}.detail-grid p>span{color:#897b72}.detail-grid strong{color:#3b2d2d;font-weight:600;line-height:1.6}.detail-wide{grid-column:1/-1}.history-line{padding:.45rem;border-bottom:1px solid #eee6df;font-size:.64rem}@media(max-width:700px){.detail-grid{grid-template-columns:1fr}.page-actions{width:100%}}
</style>
