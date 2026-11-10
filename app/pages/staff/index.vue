<script setup lang="ts">
import { CalendarDays, CheckCircle2, Clock, RefreshCw, UserRound, XCircle } from '@lucide/vue'
import { SALON_TIMEZONE } from '~~/shared/constants/business'
definePageMeta({ layout: 'staff', middleware: 'staff' })

type AgendaItem = { id: string; reference: string; status: string; startsAt: string; endsAt: string; customer: string; phone: string; services: Array<{ name: string; durationMinutes: number }> }
type Agenda = { staffProfile: { id: string; firstName: string } | null; today: AgendaItem[]; upcoming: AgendaItem[]; past: AgendaItem[] }

const { data: agenda, pending, error, refresh } = await useFetch<Agenda>('/api/staff/agenda', { key: 'staff-agenda' })
const busyId = ref(''), actionError = ref(''), actionOk = ref('')

const dayFormatter = new Intl.DateTimeFormat('fr-BJ', { timeZone: SALON_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })
const timeFormatter = new Intl.DateTimeFormat('fr-BJ', { timeZone: SALON_TIMEZONE, hour: '2-digit', minute: '2-digit' })
const dayLabel = (iso: string) => dayFormatter.format(new Date(iso))
const timeLabel = (iso: string) => timeFormatter.format(new Date(iso))
const statusLabel = (status: string) => ({ confirmed: 'Confirmé', completed: 'Terminé', no_show: 'Absente' }[status] ?? status)

async function mark(item: AgendaItem, status: 'completed' | 'no_show') {
  busyId.value = item.id; actionError.value = ''; actionOk.value = ''
  try {
    await $fetch(`/api/staff/appointments/${item.id}`, { method: 'PATCH', body: { status } })
    actionOk.value = status === 'completed' ? `« ${item.customer} » marquée venue.` : `« ${item.customer} » marquée absente.`
    await refresh()
  } catch (err) {
    const data = (err as { data?: { message?: string; statusMessage?: string } })?.data
    actionError.value = data?.message || data?.statusMessage || 'Mise à jour impossible pour le moment.'
  } finally { busyId.value = '' }
}

useSeoMeta({ title: 'Mon agenda — Espace équipe', robots: 'noindex,nofollow' })
</script>
<template>
  <div>
    <header class="staff-head"><div><span class="eyebrow">Espace équipe</span><h1>Mon agenda</h1><p v-if="agenda?.staffProfile">Fiche : {{agenda.staffProfile.firstName}} — seules vos prestations apparaissent. Marquez la cliente venue ou absente après son passage.</p><p v-else>Votre compte n’est pas encore rattaché à une fiche employée ; demandez au propriétaire de vous associer à votre profil.</p></div><button class="btn btn-ghost" :disabled="pending" @click="refresh()"><RefreshCw :size="15"/> Actualiser</button></header>

    <p v-if="error" class="staff-alert">Impossible de charger l’agenda. Reconnectez-vous si le problème persiste.</p>
    <p v-if="actionOk" class="staff-ok">{{actionOk}}</p>
    <p v-if="actionError" class="staff-alert">{{actionError}}</p>

    <section v-reveal class="staff-block"><h2><CalendarDays :size="16"/> Aujourd’hui</h2>
      <p v-if="!agenda?.today.length" class="staff-empty">Aucun rendez-vous aujourd’hui.</p>
      <article v-for="item in agenda?.today||[]" :key="item.id" class="staff-card">
        <div class="staff-card__time"><strong>{{timeLabel(item.startsAt)}}</strong><small>→ {{timeLabel(item.endsAt)}}</small></div>
        <div class="staff-card__body"><strong class="staff-card__client"><UserRound :size="14"/> {{item.customer}}</strong><small>{{item.phone}}</small><ul><li v-for="service in item.services" :key="service.name">{{service.name}} · {{service.durationMinutes}} min</li></ul></div>
        <div class="staff-card__actions"><span :class="['staff-badge',`is-${item.status}`]">{{statusLabel(item.status)}}</span>
          <button v-if="item.status==='confirmed'" class="btn btn-primary" :disabled="busyId===item.id" @click="mark(item,'completed')"><CheckCircle2 :size="14"/> Venue</button>
          <button v-if="item.status==='confirmed'" class="btn btn-ghost" :disabled="busyId===item.id" @click="mark(item,'no_show')"><XCircle :size="14"/> Absente</button>
        </div>
      </article>
    </section>

    <section v-reveal class="staff-block"><h2><Clock :size="16"/> À venir</h2>
      <p v-if="!agenda?.upcoming.length" class="staff-empty">Rien de planifié ensuite.</p>
      <article v-for="item in agenda?.upcoming||[]" :key="item.id" class="staff-card"><div class="staff-card__time"><strong>{{dayLabel(item.startsAt)}}</strong><small>{{timeLabel(item.startsAt)}}</small></div><div class="staff-card__body"><strong class="staff-card__client">{{item.customer}}</strong><ul><li v-for="service in item.services" :key="service.name">{{service.name}} · {{service.durationMinutes}} min</li></ul></div><div class="staff-card__actions"><span :class="['staff-badge',`is-${item.status}`]">{{statusLabel(item.status)}}</span></div></article>
    </section>

    <section v-reveal class="staff-block"><h2>7 derniers jours</h2>
      <p v-if="!agenda?.past.length" class="staff-empty">Pas d’historique récent.</p>
      <article v-for="item in agenda?.past||[]" :key="item.id" class="staff-card is-past"><div class="staff-card__time"><strong>{{dayLabel(item.startsAt)}}</strong><small>{{timeLabel(item.startsAt)}}</small></div><div class="staff-card__body"><strong class="staff-card__client">{{item.customer}}</strong><ul><li v-for="service in item.services" :key="service.name">{{service.name}}</li></ul></div><div class="staff-card__actions"><span :class="['staff-badge',`is-${item.status}`]">{{statusLabel(item.status)}}</span></div></article>
    </section>
  </div>
</template>
<style scoped>
.staff-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:1.4rem}
.staff-head h1{margin:.3rem 0;font-family:var(--font-display);font-size:clamp(2.2rem,4vw,3.2rem);font-weight:500}.staff-head p{margin:.2rem 0;color:#81756e;font-size:.74rem;max-width:560px}
.staff-block{margin-bottom:2rem}.staff-block h2{display:flex;align-items:center;gap:.5rem;font-family:var(--font-display);font-size:1.4rem;font-weight:500;margin-bottom:.8rem}
.staff-card{display:flex;flex-wrap:wrap;align-items:center;gap:1rem;border:1px solid #e5dbd2;border-radius:.85rem;padding:.9rem 1.1rem;margin-bottom:.6rem;background:#fffdf9}
.staff-card.is-past{opacity:.75}
.staff-card__time{min-width:110px}.staff-card__time strong{display:block;font-size:.9rem}.staff-card__time small{color:#968981;font-size:.62rem}
.staff-card__body{flex:1;min-width:220px}.staff-card__client{display:flex;align-items:center;gap:.4rem;font-size:.82rem}.staff-card__body small{display:block;color:#877b73;font-size:.66rem}.staff-card__body ul{margin:.35rem 0 0;padding:0;list-style:none}.staff-card__body li{color:#5d514b;font-size:.68rem}
.staff-card__actions{display:flex;align-items:center;gap:.5rem}
.staff-badge{border:1px solid #e0d5cc;border-radius:999px;padding:.3rem .7rem;font-size:.6rem;text-transform:uppercase;letter-spacing:.06em}.staff-badge.is-confirmed{color:#32635c;border-color:#bcd9d4;background:#eef7f5}.staff-badge.is-completed{color:#32734e;border-color:#bcdcc6;background:#eef7ef}.staff-badge.is-no_show{color:#943d48;border-color:#e0c4c6;background:#fbeff0}
.staff-empty{color:#877b73;font-size:.72rem;padding:.9rem 0}
.staff-alert{border:1px solid #e5cbc9;border-radius:.7rem;padding:.8rem 1rem;color:#8c3c43;background:#fff7f6;font-size:.72rem;margin-bottom:.9rem}
.staff-ok{border:1px solid #bcdcc6;border-radius:.7rem;padding:.8rem 1rem;color:#32734e;background:#f2faf4;font-size:.72rem;margin-bottom:.9rem}
</style>
