<script setup lang="ts">
import { ArrowLeft, ArrowRight, ShieldCheck } from '@lucide/vue'
const reference = ref(''), phone = ref(''), code = ref(''), requested = ref(false), busy = ref(false), errorMessage = ref(''), infoMessage = ref('')
async function requestCode() {
  busy.value = true; errorMessage.value = ''; infoMessage.value = ''
  try {
    const result = await $fetch<{ message: string }>('/api/public/booking-recovery/request', { method: 'POST', body: { reference: reference.value, phone: phone.value } })
    requested.value = true; infoMessage.value = result.message
  } catch (error) { errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || 'La demande ne peut pas être envoyée pour le moment.' }
  finally { busy.value = false }
}
async function verifyCode() {
  busy.value = true; errorMessage.value = ''
  try {
    const result = await $fetch<{ bookingId: string; guestAccessToken: string }>('/api/public/booking-recovery/verify', { method: 'POST', body: { reference: reference.value, phone: phone.value, code: code.value } })
    sessionStorage.setItem('onglerie-guest-token', result.guestAccessToken)
    sessionStorage.setItem('onglerie-booking-id', result.bookingId)
    await navigateTo(`/reservation/confirmation?booking=${encodeURIComponent(result.bookingId)}`)
  } catch (error) { errorMessage.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Code invalide ou expiré. Demandez un nouveau code si nécessaire.' }
  finally { busy.value = false }
}
useSeoMeta({ title: 'Récupérer une réservation', description: 'Récupération sécurisée de votre réservation invité.', robots: 'noindex,nofollow' })
</script>

<template>
  <div class="container-page recovery-page">
    <section v-reveal class="recovery-card surface-card">
      <div class="recovery-mark"><ShieldCheck :size="22"/></div>
      <span class="eyebrow">Accès invité</span>
      <h1 class="display">Retrouver votre<br><em>rendez-vous.</em></h1>
      <p class="recovery-copy">Un code à usage unique est envoyé au numéro ou à l’adresse déjà enregistrés lors de la réservation. Le code expire au bout de dix minutes.</p>
      <form v-if="!requested" class="recovery-form" @submit.prevent="requestCode">
        <label>Référence de réservation<input v-model="reference" autocomplete="off" required maxlength="32" placeholder="ON-…" /></label>
        <label>Numéro utilisé lors de la réservation<input v-model="phone" autocomplete="tel" inputmode="tel" required maxlength="25" placeholder="+229 …" /></label>
        <button class="btn btn-primary" type="submit" :disabled="busy">{{ busy ? 'Envoi…' : 'Recevoir un code' }} <ArrowRight :size="15"/></button>
      </form>
      <form v-else class="recovery-form" @submit.prevent="verifyCode">
        <p class="recovery-info" role="status">{{ infoMessage }}</p>
        <label>Code à six chiffres<input v-model="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" required minlength="6" maxlength="6" placeholder="••••••" /></label>
        <div class="recovery-actions"><button class="btn btn-primary" type="submit" :disabled="busy || code.length !== 6">{{ busy ? 'Vérification…' : 'Ouvrir mon suivi' }} <ArrowRight :size="15"/></button><button class="recovery-retry" type="button" :disabled="busy" @click="requested=false; code=''; infoMessage=''">Renvoyer un code</button></div>
      </form>
      <p v-if="errorMessage" class="recovery-error" role="alert">{{ errorMessage }}</p>
      <NuxtLink class="recovery-back" to="/reservation/confirmation"><ArrowLeft :size="14"/> Revenir au suivi</NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.recovery-page{display:grid;min-height:72vh;place-items:center;padding-block:4rem}.recovery-card{width:min(100%,580px);padding:clamp(1.5rem,5vw,3rem);border:1px solid color-mix(in srgb,var(--merlot) 12%,transparent);border-radius:1.2rem;text-align:center;box-shadow:var(--shadow-soft)}.recovery-mark{display:grid;width:50px;height:50px;place-items:center;margin:0 auto 1rem;border:1px solid color-mix(in srgb,var(--merlot) 22%,transparent);border-radius:50%;color:var(--merlot);background:color-mix(in srgb,var(--rose) 12%,var(--paper))}.recovery-card h1{margin:.65rem 0;font-size:clamp(2.4rem,6vw,4rem);line-height:.98}.recovery-card h1 em{color:var(--merlot);font-weight:400}.recovery-copy{max-width:440px;margin:0 auto 1.4rem;color:var(--muted);font-size:.75rem;line-height:1.7}.recovery-form{display:grid;gap:.8rem;text-align:left}.recovery-form label{display:grid;gap:.35rem;color:var(--ink);font-size:.68rem;font-weight:700}.recovery-form input{min-height:46px;border:1px solid var(--line);border-radius:.55rem;padding:.65rem .75rem;color:var(--ink);background:var(--paper);font:inherit}.recovery-form input:focus-visible{outline:2px solid var(--merlot);outline-offset:2px}.recovery-form .btn{justify-content:center;margin-top:.3rem}.recovery-actions{display:grid;justify-items:center;gap:.7rem}.recovery-retry,.recovery-back{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;border:0;color:var(--merlot);font-size:.65rem;font-weight:700;background:transparent;cursor:pointer}.recovery-info{margin:0;color:var(--muted);font-size:.68rem;line-height:1.6}.recovery-error{margin:.8rem 0 0;border:1px solid #e5cbc7;border-radius:.5rem;padding:.7rem;color:#853b42;background:#fff6f4;font-size:.68rem}.recovery-back{margin-top:1.4rem;color:var(--muted)}
</style>
