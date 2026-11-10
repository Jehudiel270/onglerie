<script setup lang="ts">
import { KeyRound, ShieldAlert, UserCog } from '@lucide/vue'
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Comptes & accès — Développement', robots: 'noindex,nofollow' })

type Account = {
  id: string; name: string; email: string; platformRole: string; createdAt: string
  staffProfile: { id: string; label: string } | null
  memberships: Array<{ salonId: string; salonName: string; role: string; active: boolean }>
}
type DevData = { items: Account[]; salons: Array<{ id: string; name: string; status: string }>; unlinkedProfiles: Array<{ id: string; salonId: string; label: string }> }

const { data: session } = await useFetch<{ role: string }>('/api/admin/session', { key: 'admin-comptes-session' })
const isDevSession = computed(() => session.value?.role === 'dev')

const { data, refresh } = await useFetch<DevData>('/api/admin/dev-accounts', { key: 'admin-dev-accounts', default: () => null as never, server: false })
const accounts = computed<Account[]>(() => data.value?.items ?? [])

const ROLE_LABELS: Record<string, string> = { owner: 'Gérante', reception: 'Réception', staff: 'Employée', dev: 'Développeur', customer: 'Cliente' }

// Création d'un accès
const createForm = reactive({ name: '', email: '', password: '', role: 'reception', staffId: '' })
const createBusy = ref(false), createError = ref(''), createOk = ref('')
const profilesForRole = computed(() => data.value?.unlinkedProfiles ?? [])
const needsProfile = computed(() => createForm.role === 'staff' || createForm.role === 'reception')
async function submitCreate() {
  createBusy.value = true; createError.value = ''; createOk.value = ''
  try {
    const result = await $fetch<{ guidance: string }>('/api/admin/dev-accounts', { method: 'POST', body: {
      action: 'create', name: createForm.name.trim(), email: createForm.email.trim().toLowerCase(), password: createForm.password, role: createForm.role,
      ...(needsProfile.value && createForm.staffId ? { staffId: createForm.staffId } : {}),
    } })
    createOk.value = result.guidance
    createForm.name = ''; createForm.email = ''; createForm.password = ''; createForm.staffId = ''
    await refresh()
  } catch (error) { const detail = (error as { data?: { statusMessage?: string; message?: string } })?.data; createError.value = detail?.statusMessage || detail?.message || 'Création impossible.' } finally { createBusy.value = false }
}

// Réinitialisation de mot de passe
const resetForm = reactive({ userId: '', password: '' })
const resetBusy = ref(false), resetError = ref(''), resetOk = ref('')
async function submitReset() {
  resetBusy.value = true; resetError.value = ''; resetOk.value = ''
  try {
    const result = await $fetch<{ guidance: string }>('/api/admin/dev-accounts', { method: 'POST', body: { action: 'reset_password', userId: resetForm.userId, password: resetForm.password } })
    resetOk.value = result.guidance
    resetForm.userId = ''; resetForm.password = ''
  } catch (error) { const detail = (error as { data?: { statusMessage?: string; message?: string } })?.data; resetError.value = detail?.statusMessage || detail?.message || 'Réinitialisation impossible.' } finally { resetBusy.value = false }
}

// Actions par adhésion : changement de rôle, activation, désactivation
const rowBusy = ref(''), rowError = ref(''), rowOk = ref('')
async function changeRole(account: Account, membership: Account['memberships'][number], role: string) {
  if (role === membership.role) return
  rowBusy.value = account.id; rowError.value = ''; rowOk.value = ''
  try {
    const result = await $fetch<{ guidance: string }>('/api/admin/dev-accounts', { method: 'POST', body: { action: 'change_role', userId: account.id, salonId: membership.salonId, role } })
    rowOk.value = result.guidance
    await refresh()
  } catch (error) { const detail = (error as { data?: { statusMessage?: string; message?: string } })?.data; rowError.value = detail?.statusMessage || detail?.message || 'Changement impossible.' } finally { rowBusy.value = '' }
}
async function setActive(account: Account, membership: Account['memberships'][number], active: boolean) {
  rowBusy.value = account.id; rowError.value = ''; rowOk.value = ''
  try {
    const result = await $fetch<{ guidance: string }>('/api/admin/dev-accounts', { method: 'POST', body: { action: 'set_active', userId: account.id, salonId: membership.salonId, active } })
    rowOk.value = result.guidance
    await refresh()
  } catch (error) { const detail = (error as { data?: { statusMessage?: string; message?: string } })?.data; rowError.value = detail?.statusMessage || detail?.message || 'Action impossible.' } finally { rowBusy.value = '' }
}
</script>
<template>
  <div>
    <div class="admin-page-head"><div><h1>Comptes &amp; accès</h1><p>Panneau du rôle développement : préparer, dépanner et transférer les accès du salon — et de ses futures succursales si besoin.</p></div></div>

    <div v-if="!isDevSession" class="admin-alert"><ShieldAlert :size="15" /> Section réservée au rôle développeur. Votre compte n’a pas ce niveau ; adressez-vous à l’équipe technique.</div>

    <template v-else>
      <section class="admin-card">
        <div class="admin-card__title"><h2><UserCog :size="18" /> Créer un accès</h2></div>
        <p class="comptes-help">Le salon n’a qu’<strong>une seule gérante</strong> : sa propriétaire, qui voit tout et crée son équipe. La <strong>réception</strong> gère le quotidien sans le chiffre d’affaires ; elle peut être rattachée à une fiche praticienne si elle fait aussi des poses. L’<strong>employée</strong> doit être rattachée à sa fiche : elle ne voit que son agenda sur /staff. Les comptes développeurs ne se créent jamais ici, uniquement via le script serveur <code>bootstrap:dev</code>.</p>
        <form class="admin-form-grid" @submit.prevent="submitCreate">
          <label class="form-field"><span>Nom complet *</span><input v-model="createForm.name" class="form-control" required maxlength="120" autocomplete="off"></label>
          <label class="form-field"><span>E-mail de connexion *</span><input v-model="createForm.email" type="email" class="form-control" required maxlength="254" autocomplete="off"></label>
          <label class="form-field"><span>Mot de passe initial * (14 caractères recommandés)</span><input v-model="createForm.password" type="password" class="form-control" required minlength="8" maxlength="72" autocomplete="new-password"></label>
          <label class="form-field"><span>Rôle salon *</span><select v-model="createForm.role" class="form-control"><option value="owner">Gérante — la propriétaire (une seule)</option><option value="reception">Réception — quotidien sans CA</option><option value="staff">Employée — agenda personnel</option></select></label>
          <label v-if="needsProfile" class="form-field"><span>Fiche praticienne {{ createForm.role === 'staff' ? '*' : '(facultative — pratique des poses)' }}</span><select v-model="createForm.staffId" class="form-control" :required="createForm.role === 'staff'"><option value="" :disabled="createForm.role === 'staff'">{{ createForm.role === 'staff' ? 'Choisir une fiche sans accès' : 'Aucune fiche (bureau uniquement)' }}</option><option v-for="profile in profilesForRole" :key="profile.id" :value="profile.id">{{ profile.label }}</option></select></label>
          <div class="wide comptes-actions"><button class="btn btn-primary" type="submit" :disabled="createBusy || !createForm.name || !createForm.email || !createForm.password">{{ createBusy ? 'Création…' : 'Créer l’accès' }}</button></div>
          <p v-if="createOk" class="admin-success wide">{{ createOk }}</p>
          <p v-if="createError" class="admin-alert wide">{{ createError }}</p>
        </form>
      </section>

      <section class="admin-card">
        <div class="admin-card__title"><h2><KeyRound :size="18" /> Réinitialiser un mot de passe</h2></div>
        <p class="comptes-help">Le nouveau mot de passe est appliqué immédiatement et toutes les sessions ouvertes du compte sont fermées. Utilisez-le pour dépanner une gérante ou une employée qui a perdu son accès.</p>
        <form class="admin-form-grid" @submit.prevent="submitReset">
          <label class="form-field"><span>Compte *</span><select v-model="resetForm.userId" class="form-control" required><option value="" disabled>Choisir un compte</option><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.email }} — {{ ROLE_LABELS[account.platformRole] || account.platformRole }}{{ account.platformRole === 'dev' ? ' (non modifiable)' : '' }}</option></select></label>
          <label class="form-field"><span>Nouveau mot de passe * (14 caractères recommandés)</span><input v-model="resetForm.password" type="password" class="form-control" required minlength="8" maxlength="72" autocomplete="new-password"></label>
          <div class="wide comptes-actions"><button class="btn btn-primary" type="submit" :disabled="resetBusy || !resetForm.userId || !resetForm.password">{{ resetBusy ? 'Application…' : 'Réinitialiser' }}</button></div>
          <p v-if="resetOk" class="admin-success wide">{{ resetOk }}</p>
          <p v-if="resetError" class="admin-alert wide">{{ resetError }}</p>
        </form>
      </section>

      <section class="admin-card">
        <div class="admin-card__title"><h2>Comptes de la plateforme</h2><span class="comptes-count">{{ accounts.length }} compte(s)</span></div>
        <p v-if="rowOk" class="admin-success comptes-note">{{ rowOk }}</p>
        <p v-if="rowError" class="admin-alert comptes-note">{{ rowError }}</p>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Compte</th><th>Rôle plateforme</th><th>Fiche liée</th><th>Adhésions salon & actions</th></tr></thead>
            <tbody>
              <tr v-for="account in accounts" :key="account.id">
                <td><strong>{{ account.name }}</strong><small>{{ account.email }}</small></td>
                <td>{{ ROLE_LABELS[account.platformRole] || account.platformRole }}</td>
                <td>{{ account.staffProfile ? account.staffProfile.label : '—' }}</td>
                <td>
                  <template v-if="account.memberships.length">
                    <div v-for="membership in account.memberships" :key="membership.salonId" class="membership-row">
                      <span class="membership-salon">{{ membership.salonName }}</span>
                      <select class="form-control membership-role" :value="membership.role" :disabled="account.platformRole === 'dev' || rowBusy === account.id" @change="changeRole(account, membership, ($event.target as HTMLSelectElement).value)">
                        <option value="owner">Gérante</option><option value="reception">Réception</option><option value="staff">Employée</option>
                      </select>
                      <button class="comptes-toggle" type="button" :disabled="account.platformRole === 'dev' || rowBusy === account.id" @click="setActive(account, membership, !membership.active)">{{ membership.active ? 'Désactiver' : 'Réactiver' }}</button>
                      <span :class="['var-state', { 'is-ok': membership.active }]">{{ membership.active ? 'actif' : 'inactif' }}</span>
                    </div>
                  </template>
                  <span v-else class="comptes-none">{{ account.platformRole === 'dev' ? 'Accès plateforme (compte développeur)' : account.platformRole === 'customer' ? 'Espace cliente uniquement' : 'Aucune adhésion salon' }}</span>
                </td>
              </tr>
              <tr v-if="!accounts.length"><td colspan="4" class="admin-empty">Aucun compte ; la liste se remplit après la première création.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
<style scoped>
.comptes-help{padding:.85rem 1.15rem;color:#81756e;font-size:.7rem}.comptes-help code{background:#f7f1f0;border-radius:.3rem;padding:.05rem .3rem;font-size:.62rem}
.comptes-actions{display:flex;align-items:center;gap:.8rem}
.comptes-count{color:#877b73;font-size:.62rem}
.comptes-note{margin:.6rem 1.15rem 0}
.membership-row{display:flex;flex-wrap:wrap;align-items:center;gap:.45rem;padding:.15rem 0}
.membership-salon{color:#2b2422;font-size:.66rem;font-weight:700}
.membership-role{width:auto;min-width:130px;min-height:32px;font-size:.62rem}
.comptes-toggle{border:1px solid #e4d6d6;border-radius:999px;padding:.35rem .65rem;color:#6b2d45;background:#fffaf8;font-size:.6rem;cursor:pointer}
.comptes-none{color:#968981;font-size:.62rem}
.comptes-help + .admin-form-grid{border-top:1px solid #eee7df;padding-top:1rem}
</style>
