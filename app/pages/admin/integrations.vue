<script setup lang="ts">
import { CheckCircle2, CircleDashed, KeyRound, ShieldCheck, Trash2 } from '@lucide/vue'
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Intégrations — Administration', robots: 'noindex,nofollow' })

const { data: session } = await useFetch<{ role: string }>('/api/admin/session', { key: 'admin-integrations-session' })
const isDevSession = computed(() => session.value?.role === 'dev')

type Integration = {
  key: string
  label: string
  description: string
  required: boolean
  configured: boolean
  missing: string[]
  variables: { name: string; configured: boolean }[]
}

const STATIC_GROUPS: Integration[] = [
  { key: 'database', label: 'Base de données Neon PostgreSQL', description: 'Runtime poolé + connexion directe pour Drizzle Kit et les migrations.', required: true, configured: false, missing: ['NEON_DATABASE_URL', 'NEON_DATABASE_URL_UNPOOLED'], variables: [{ name: 'NEON_DATABASE_URL', configured: false }, { name: 'NEON_DATABASE_URL_UNPOOLED', configured: false }] },
  { key: 'auth', label: 'Authentification Better Auth', description: 'Secret de sessions et empreintes HMAC des codes OTP (≥ 32 octets).', required: true, configured: false, missing: ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'], variables: [{ name: 'BETTER_AUTH_SECRET', configured: false }, { name: 'BETTER_AUTH_URL', configured: false }] },
  { key: 'payments', label: 'Paiements FedaPay', description: 'Transactions XOF côté serveur ; commencer en sandbox.', required: false, configured: false, missing: ['FEDAPAY_SECRET_KEY', 'FEDAPAY_WEBHOOK_SECRET', 'FEDAPAY_ENV'], variables: [{ name: 'FEDAPAY_SECRET_KEY', configured: false }, { name: 'FEDAPAY_WEBHOOK_SECRET', configured: false }, { name: 'FEDAPAY_ENV', configured: false }] },
  { key: 'media', label: 'Médias Cloudinary', description: 'Uploads signés serveur pour couverture, services, réalisations et équipe.', required: false, configured: false, missing: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'], variables: [{ name: 'CLOUDINARY_CLOUD_NAME', configured: false }, { name: 'CLOUDINARY_API_KEY', configured: false }, { name: 'CLOUDINARY_API_SECRET', configured: false }] },
  { key: 'scheduled', label: 'Tâches planifiées', description: 'Expiration des retenues et rappels protégés par CRON_SECRET.', required: false, configured: false, missing: ['CRON_SECRET', 'BOOKING_HOLD_MINUTES'], variables: [{ name: 'CRON_SECRET', configured: false }, { name: 'BOOKING_HOLD_MINUTES', configured: false }] },
  { key: 'whatsapp', label: 'WhatsApp Business Cloud', description: 'Modèles approuvés Meta requis ; repli wa.me sans fournisseur.', required: false, configured: false, missing: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID'], variables: [{ name: 'WHATSAPP_ACCESS_TOKEN', configured: false }, { name: 'WHATSAPP_PHONE_NUMBER_ID', configured: false }, { name: 'WHATSAPP_BUSINESS_ACCOUNT_ID', configured: false }] },
  { key: 'email', label: 'E-mail transactionnel', description: 'Adaptateur HTTP générique (URL, clé, expéditeur).', required: false, configured: false, missing: ['EMAIL_API_URL', 'EMAIL_API_KEY', 'EMAIL_FROM'], variables: [{ name: 'EMAIL_API_URL', configured: false }, { name: 'EMAIL_API_KEY', configured: false }, { name: 'EMAIL_FROM', configured: false }] },
]

const GUIDANCE = 'Sans rôle développement : les valeurs s’ajoutent dans le gestionnaire de secrets Vercel (« Environment variables »), puis redéploiement. Si vous êtes développeur de la plateforme, une section dédiée ci-dessous permet aussi d’enregistrer les clés directement, sans redéploiement. Les valeurs ne sont jamais affichées ni collectées ici.'

const { data, error } = await useFetch<{ integrations: Integration[]; guidance: string }>('/api/admin/integrations', { key: 'admin-integrations', default: () => null as never })
const integrations = computed<Integration[]>(() => data.value?.integrations ?? [])
const degraded = computed(() => Boolean(error.value) && integrations.value.length === 0)

// Section développement : enregistrement des clés en base (repli des variables
// d'environnement), actif immédiatement sans redéploiement. Réservée au rôle
// plateforme dev ; les valeurs ne sont jamais réaffichées en clair.
type ConfigItem = { key: string; source: 'env' | 'database' | 'none'; configured: boolean; masked: string }
const { data: configData, refresh: refreshConfig } = await useFetch<{ items: ConfigItem[]; guidance: string }>('/api/admin/platform-config', { key: 'admin-platform-config', default: () => null as never, server: false })
const configItems = computed<ConfigItem[]>(() => configData.value?.items ?? [])
const editingKey = ref(''), editingValue = ref(''), configBusy = ref(false), configMessage = ref(''), configError = ref('')
const sourceLabels: Record<string, string> = { env: 'variable d’environnement (prioritaire)', database: 'enregistrée ici (panneau dev)', none: 'non configurée' }
async function saveConfigKey() {
  configBusy.value = true; configMessage.value = ''; configError.value = ''
  try {
    const result = await $fetch<{ guidance: string }>('/api/admin/platform-config', { method: 'POST', body: { key: editingKey.value, value: editingValue.value } })
    configMessage.value = result.guidance; editingKey.value = ''; editingValue.value = ''
    await refreshConfig()
  } catch (err) { const detail = (err as { data?: { statusMessage?: string; message?: string } })?.data; configError.value = detail?.statusMessage || detail?.message || 'Enregistrement impossible.' } finally { configBusy.value = false }
}
async function clearConfigKey(key: string) {
  configBusy.value = true; configMessage.value = ''; configError.value = ''
  try {
    const result = await $fetch<{ guidance: string }>('/api/admin/platform-config', { method: 'POST', body: { key, value: null } })
    configMessage.value = result.guidance
    await refreshConfig()
  } catch (err) { const detail = (err as { data?: { statusMessage?: string; message?: string } })?.data; configError.value = detail?.statusMessage || detail?.message || 'Suppression impossible.' } finally { configBusy.value = false }
}
</script>
<template>
  <div>
    <div class="admin-page-head"><div><h1>Intégrations</h1><p>État de configuration côté serveur. Aucune valeur de clé n’est affichée ni collectée ici.</p></div></div>

    <div v-if="degraded" class="admin-alert degraded-note">
      <p><strong>État indisponible.</strong> La session ou la base n’est pas encore opérationnelle : configurez d’abord <code>NEON_DATABASE_URL</code>, <code>NEON_DATABASE_URL_UNPOOLED</code> et <code>BETTER_AUTH_SECRET</code> dans le gestionnaire de secrets du projet, reconnectez-vous, puis revenez ici pour voir l’état réel.</p>
      <p>Pour rappel, la liste complète des variables par intégration est fournie dans <code>.env.example</code> et ci-dessous.</p>
    </div>

    <div class="integration-grid">
      <article v-for="item in (degraded ? STATIC_GROUPS : integrations)" :key="item.key" class="admin-card integration-card">
        <div class="integration-head">
          <h2>{{ item.label }}</h2>
          <span :class="['status-pill', { 'is-ok': item.configured }]">
            <component :is="item.configured ? CheckCircle2 : CircleDashed" :size="14"/>
            {{ degraded ? 'État inconnu' : (item.configured ? 'Configuré' : 'À configurer') }}
          </span>
        </div>
        <p class="integration-desc">{{ item.description }}</p>
        <ul class="var-list">
          <li v-for="variable in item.variables" :key="variable.name">
            <code>{{ variable.name }}</code>
            <span :class="['var-state', { 'is-ok': !degraded && variable.configured }]">
              {{ degraded ? 'à vérifier' : (variable.configured ? 'présente' : 'manquante') }}
            </span>
          </li>
        </ul>
        <small v-if="item.required" class="required-note">Requise pour l’exploitation.</small>
      </article>
    </div>

    <p class="guidance-note"><ShieldCheck :size="15"/> {{ data?.guidance || GUIDANCE }}</p>

    <section v-if="isDevSession && configItems.length" class="admin-card dev-config">
      <div class="admin-card__title"><h2><KeyRound :size="18"/> Clés de la plateforme — rôle développement</h2></div>
      <p class="dev-config__help">Ces clés servent de repli aux variables d’environnement Vercel (qui restent prioritaires) et s’appliquent immédiatement, sans redéploiement. Les valeurs ne sont jamais réaffichées : seuls les 4 derniers caractères servent à les reconnaître. Laissez vides si vous gérez tout depuis Vercel.</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Clé</th><th>Source</th><th>Valeur enregistrée</th><th></th></tr></thead>
          <tbody>
            <tr v-for="item in configItems" :key="item.key">
              <td><code>{{ item.key }}</code></td>
              <td>{{ sourceLabels[item.source] }}</td>
              <td><span :class="['var-state', { 'is-ok': item.configured }]">{{ item.configured ? item.masked : '—' }}</span></td>
              <td><button v-if="item.source === 'database'" class="dev-config__delete" type="button" :disabled="configBusy" @click="clearConfigKey(item.key)"><Trash2 :size="13"/> Retirer</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <form class="admin-form-grid dev-config__form" @submit.prevent="saveConfigKey">
        <label class="form-field"><span>Clé *</span><select v-model="editingKey" class="form-control" required><option value="" disabled>Choisir une clé</option><option v-for="item in configItems" :key="item.key" :value="item.key" :disabled="item.source === 'env'">{{ item.key }}{{ item.source === 'env' ? ' — déjà via Vercel' : '' }}</option></select></label>
        <label class="form-field"><span>Valeur *</span><input v-model="editingValue" class="form-control" type="password" autocomplete="off" required placeholder="Coller la clé complète"></label>
        <div class="wide dev-config__actions"><button class="btn btn-primary" type="submit" :disabled="configBusy || !editingKey || !editingValue">{{ configBusy ? 'Enregistrement…' : 'Enregistrer la clé' }}</button></div>
        <p v-if="configMessage" class="admin-success wide">{{ configMessage }}</p>
        <p v-if="configError" class="admin-alert wide">{{ configError }}</p>
      </form>
    </section>
  </div>
</template>
<style scoped>
.degraded-note{margin-bottom:1.1rem;font-size:.72rem}
.degraded-note code,.guidance-note code{background:#f7f1f0;border-radius:.3rem;padding:.05rem .3rem}
.integration-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.85rem}
.integration-card{padding:1rem 1.15rem}
.integration-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.8rem}
.integration-head h2{margin:0;font-family:var(--font-display);font-size:1.25rem;font-weight:500}
.status-pill{display:inline-flex;align-items:center;gap:.35rem;flex:none;border:1px solid #e4d6d6;border-radius:999px;padding:.35rem .65rem;color:#8c5b45;background:#fffaf8;font-size:.6rem;white-space:nowrap}
.status-pill.is-ok{color:#32734e;border-color:#cfe3d5;background:#f2faf4}
.integration-desc{margin:.5rem 0 .8rem;color:#877b73;font-size:.68rem}
.var-list{display:grid;gap:.4rem;margin:0;padding:0;list-style:none}
.var-list li{display:flex;align-items:center;justify-content:space-between;gap:.6rem}
.var-list code{color:#4a403b;font-size:.66rem}
.var-state{color:#a3552e;font-size:.6rem}
.var-state.is-ok{color:#32734e}
.required-note{display:block;margin-top:.7rem;color:#6b2d45;font-size:.58rem}
.guidance-note{display:flex;align-items:flex-start;gap:.5rem;margin-top:1.2rem;color:#716660;font-size:.68rem}
.dev-config{margin-top:1.4rem}.dev-config__help{padding:.8rem 1.15rem;color:#81756e;font-size:.68rem}.dev-config__input-cell{color:#968981;font-size:.6rem}.dev-config__delete{display:inline-flex;align-items:center;gap:.3rem;border:1px solid #e5cbc9;border-radius:999px;padding:.35rem .6rem;color:#8c3c43;background:#fff7f6;font-size:.6rem;cursor:pointer}.dev-config__form{border-top:1px solid #eee7df;padding-top:1rem}.dev-config__actions{display:flex;align-items:center;gap:.8rem}
@media(max-width:900px){.integration-grid{grid-template-columns:1fr}}
</style>
