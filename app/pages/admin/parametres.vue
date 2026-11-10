<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'
import { Building2 } from '@lucide/vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const salonFields = [
  { key: 'name', label: 'Nom public', required: true },
  { key: 'description', label: 'Présentation', type: 'textarea' as const },
  { key: 'phone', label: 'Téléphone' },
  { key: 'whatsapp', label: 'WhatsApp (format international, ex. 22997000000)' },
  { key: 'email', label: 'E-mail de contact' },
  { key: 'address', label: 'Adresse' },
  { key: 'city', label: 'Ville' },
  { key: 'instagram', label: 'Instagram (pseudo ou lien complet)', help: 'Ces coordonnées alimentent automatiquement le site public : pied de page, page contact et liens WhatsApp « Réserver / Discuter ».' },
]

const salonColumns = [
  { key: 'name', label: 'Salon' },
  { key: 'city', label: 'Ville' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'E-mail' },
  { key: 'timezone', label: 'Fuseau' },
  { key: 'currency', label: 'Devise' },
]

const settingFields = [
  { key: 'holdMinutes', label: 'Durée de retenue (minutes)', type: 'number' as const, required: true, defaultValue: 10, help: 'La redirection de paiement ne confirme jamais le rendez-vous.' },
  { key: 'minAdvanceHours', label: 'Délai minimum avant rendez-vous (heures)', type: 'number' as const, required: true, defaultValue: 2 },
  { key: 'maxAdvanceDays', label: 'Horizon maximum de réservation (jours)', type: 'number' as const, required: true, defaultValue: 60 },
  { key: 'depositPercent', label: 'Acompte (%) lorsque la prestation n’a pas d’acompte fixe', type: 'number' as const, required: true, defaultValue: 0 },
  { key: 'cancellationPolicy', label: 'Politique d’annulation', type: 'textarea' as const },
  { key: 'remindersEnabled', label: 'Activer les rappels planifiés', type: 'checkbox' as const, defaultValue: true },
  { key: 'reminderHours', label: 'Délais de rappel en heures (séparés par virgules)', type: 'list' as const, numericList: true, help: 'Par exemple 24, 2. Les rappels utilisent une file idempotente.' },
  { key: 'defaultTheme', label: 'Thème public par défaut', type: 'select' as const, defaultValue: 'brand', options: [{ label: 'Marque — ivoire et bordeaux', value: 'brand' }, { label: 'Clair', value: 'light' }, { label: 'Sombre', value: 'dark' }] },
  { key: 'buttonStyle', label: 'Style des boutons publics', type: 'select' as const, defaultValue: 'pill', options: [{ label: 'Pilule', value: 'pill' }, { label: 'Arrondi doux', value: 'soft' }, { label: 'Angulaire', value: 'square' }] },
  { key: 'floatingIconsEnabled', label: 'Icônes flottantes décoratives', type: 'checkbox' as const, defaultValue: true },
  { key: 'floatingIconDensity', label: 'Nombre maximal d’icônes (0–12)', type: 'number' as const, defaultValue: 7, help: 'Le plafond mobile reste automatiquement limité.' },
  { key: 'floatingIconOpacity', label: 'Opacité des icônes (%)', type: 'number' as const, defaultValue: 12, help: 'Valeurs admises : 4 à 24 %.' },
  { key: 'glassmorphismEnabled', label: 'Surfaces en verre dépoli', type: 'checkbox' as const, defaultValue: true },
  { key: 'scrollAnimationsEnabled', label: 'Animations liées au défilement', type: 'checkbox' as const, defaultValue: true },
  { key: 'nailExperienceEnabled', label: 'Expérience 3D des matières', type: 'checkbox' as const, defaultValue: true },
  { key: 'scrollDurationScreens', label: 'Durée de l’expérience en hauteurs d’écran (4–9)', type: 'number' as const, defaultValue: 6 },
]

const settingColumns = [
  { key: 'defaultTheme', label: 'Thème' },
  { key: 'buttonStyle', label: 'Boutons' },
  { key: 'holdMinutes', label: 'Retenue (min)' },
  { key: 'minAdvanceHours', label: 'Réservation mini (h)' },
  { key: 'maxAdvanceDays', label: 'Horizon (j)' },
  { key: 'depositPercent', label: 'Acompte (%)' },
  { key: 'remindersEnabled', label: 'Rappels' },
]

useSeoMeta({ title: 'Paramètres — Administration', robots: 'noindex,nofollow' })

// Succursales : c'est la propriétaire qui crée et gère ses entités
// supplémentaires. La création lui donne automatiquement le contrôle
// complet de la nouvelle succursale ; elle la sélectionne via « Salon actif »
// en haut du panneau pour la configurer.
const { data: sessionData, refresh: refreshSession } = await useFetch<{ role: string; salonId: string; salons?: Array<{ id: string; name: string; city: string | null; status: string; role: string }> }>('/api/admin/session', { key: 'parametres-session' })
const mySalons = computed(() => sessionData.value?.salons ?? [])
const branchForm = reactive({ name: '', city: '' })
const branchBusy = ref(false), branchError = ref(''), branchOk = ref('')
async function submitBranch() {
  branchBusy.value = true; branchError.value = ''; branchOk.value = ''
  try {
    const result = await $fetch<{ guidance: string }>('/api/admin/salons', { method: 'POST', body: { name: branchForm.name.trim(), city: branchForm.city.trim() } })
    branchOk.value = result.guidance
    branchForm.name = ''; branchForm.city = ''
    await refreshSession()
  } catch (error) { const detail = (error as { data?: { statusMessage?: string; message?: string } })?.data; branchError.value = detail?.statusMessage || detail?.message || 'Création impossible.' } finally { branchBusy.value = false }
}
</script>

<template>
  <div class="settings-admin">
    <AdminResourceManager resource="salon" title="Informations du salon" description="Identité, contacts et coordonnées fournis par votre entreprise." :fields="salonFields" :columns="salonColumns" :creatable="false" :deletable="false" />

    <section v-if="['owner', 'dev'].includes(sessionData?.role || '')" class="admin-card">
      <div class="admin-card__title"><h2><Building2 :size="18" /> Succursales</h2><span class="comptes-count">{{ mySalons.length }} salon(s)</span></div>
      <p class="settings-note">Le salon appartient à la propriétaire : c'est elle qui crée ses succursales ici, jamais l'équipe ni les employées. Une succursale est un salon à part entière (coordonnées, prestations, horaires, équipe) ; après création, sélectionnez-la via « Salon actif » en haut du panneau pour la configurer, puis revenez sur « Salon principal » pour continuer à gérer l'actuel. Le site public et les réservations servent toujours le salon principal.</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Nom</th><th>Ville</th><th>Statut</th><th>Rôle</th></tr></thead>
          <tbody>
            <tr v-for="salon in mySalons" :key="salon.id"><td><strong>{{ salon.name }}</strong><small v-if="salon.id === sessionData?.salonId"> — salon affiché actuellement</small></td><td>{{ salon.city || '—' }}</td><td><span :class="['var-state', { 'is-ok': salon.status === 'active' }]">{{ salon.status }}</span></td><td>{{ salon.role }}</td></tr>
            <tr v-if="!mySalons.length"><td colspan="4" class="admin-empty">Aucune succursale enregistrée.</td></tr>
          </tbody>
        </table>
      </div>
      <form class="admin-form-grid" @submit.prevent="submitBranch">
        <label class="form-field"><span>Nom de la succursale *</span><input v-model="branchForm.name" class="form-control" required maxlength="120" autocomplete="off"></label>
        <label class="form-field"><span>Ville</span><input v-model="branchForm.city" class="form-control" maxlength="120" autocomplete="off"></label>
        <div class="wide comptes-actions"><button class="btn btn-primary" type="submit" :disabled="branchBusy || !branchForm.name">{{ branchBusy ? 'Création…' : 'Créer la succursale' }}</button></div>
        <p v-if="branchOk" class="admin-success wide">{{ branchOk }}</p>
        <p v-if="branchError" class="admin-alert wide">{{ branchError }}</p>
      </form>
    </section>

    <AdminResourceManager resource="settings" title="Réservations, rappels et apparence" description="Règles de réservation et préférences visuelles de ce salon. La préférence de réduction des animations des visiteuses reste prioritaire." :fields="settingFields" :columns="settingColumns" :creatable="false" :deletable="false" />
    <p class="settings-note">Devise : XOF · Fuseau : Africa/Porto-Novo. Les rappels ne sont envoyés que si les tâches planifiées et les variables du fournisseur sont configurées.</p>
  </div>
</template>

<style scoped>
.settings-admin { display: grid; gap: 2.5rem; }
.settings-note { color: #887c74; font-size: .69rem; }
.comptes-count { color: #877b73; font-size: .62rem; }
</style>
