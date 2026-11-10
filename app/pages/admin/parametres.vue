<script setup lang="ts">
import AdminResourceManager from '../../components/AdminResourceManager.vue'

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
</script>

<template>
  <div class="settings-admin">
    <AdminResourceManager resource="salon" title="Informations du salon" description="Identité, contacts et coordonnées fournis par votre entreprise." :fields="salonFields" :columns="salonColumns" :creatable="false" :deletable="false" />
    <AdminResourceManager resource="settings" title="Réservations, rappels et apparence" description="Règles de réservation et préférences visuelles de ce salon. La préférence de réduction des animations des visiteuses reste prioritaire." :fields="settingFields" :columns="settingColumns" :creatable="false" :deletable="false" />
    <p class="settings-note">Devise : XOF · Fuseau : Africa/Porto-Novo. Les rappels ne sont envoyés que si les tâches planifiées et les variables du fournisseur sont configurées.</p>
  </div>
</template>

<style scoped>
.settings-admin { display: grid; gap: 2.5rem; }
.settings-note { color: #887c74; font-size: .69rem; }
</style>
