import { env } from 'node:process'
import { and, eq, gte, inArray, lte, or, lt, sql } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { guestRecoveryChallenges, notificationLogs, notificationOutbox } from '../db/schema'

type OutboxRow = typeof notificationOutbox.$inferSelect
const text = (value: unknown): string => typeof value === 'string' ? value : ''
const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character))
function messageFor(row: OutboxRow) {
  const payload = row.payload
  if (row.templateKey === 'contact_message') return { subject: 'Nouveau message depuis le site', body: `Message de ${text(payload.name)}\nTéléphone : ${text(payload.phone) || 'non renseigné'}\nE-mail : ${text(payload.email) || 'non renseigné'}\n\n${text(payload.message)}` }
  if (row.templateKey === 'booking_recovery_code') return { subject: `Code à usage unique — réservation ${text(payload.reference)}`, body: `Votre code de récupération est ${text(payload.code)}. Il expire dans dix minutes et ne peut être utilisé qu’une seule fois. Ne le communiquez à personne.` }
  const reference = text(payload.reference), when = text(payload.startsAt), total = Number(payload.totalXof ?? 0).toLocaleString('fr-BJ'), paid = Number(payload.depositPaidXof ?? 0).toLocaleString('fr-BJ'), balance = Number(payload.remainingXof ?? 0).toLocaleString('fr-BJ')
  if (row.templateKey === 'booking_pending') return { subject: `Acompte en attente — ${reference}`, body: `Réservation ${reference} : paiement d’acompte en attente. Date ${when}. Total ${total} XOF.` }
  if (row.templateKey === 'booking_reminder') return { subject: `Rappel — ${reference}`, body: `Rappel (${text(payload.reminderHours)} h) : rendez-vous ${reference}, le ${when}. Solde estimé ${balance} XOF.` }
  if (row.templateKey === 'booking_payment_received') return { subject: `Paiement reçu — ${reference}`, body: `Un paiement de ${Number(payload.paymentXof ?? 0).toLocaleString('fr-BJ')} XOF a été enregistré pour votre rendez-vous ${reference}. Total : ${total} XOF. Montant encaissé à ce jour : ${paid} XOF. Solde estimé : ${balance} XOF.` }
  if (row.templateKey === 'payment_manual_review') return { subject: `Action requise : paiement à vérifier — ${reference}`, body: `FedaPay a vérifié un paiement de ${Number(payload.paymentXof ?? 0).toLocaleString('fr-BJ')} ${text(payload.currency)} pour la référence ${reference} (réf. fournisseur ${text(payload.providerReference)}). Le rendez-vous n’a pas été confirmé automatiquement (${text(payload.reason)}). Vérifiez la transaction dans FedaPay puis contactez la cliente pour décider de la suite. Aucun remboursement automatique n’a été lancé.` }
  return { subject: `Rendez-vous ${reference} confirmé`, body: `Votre rendez-vous ${reference} est confirmé. Date : ${when}. Total : ${total} XOF. Acompte reçu : ${paid} XOF. Solde : ${balance} XOF.` }
}
async function sendEmail(row: OutboxRow) {
  if (!env.EMAIL_API_URL || !env.EMAIL_API_KEY || !env.EMAIL_FROM) throw new Error('Fournisseur e-mail non configuré.')
  const destination = new URL(env.EMAIL_API_URL)
  if (destination.protocol !== 'https:' || destination.username || destination.password) throw new Error('EMAIL_API_URL doit être une URL HTTPS sans identifiants intégrés.')
  const message = messageFor(row)
  const response = await fetch(destination, { method: 'POST', headers: { authorization: `Bearer ${env.EMAIL_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': row.dedupeKey }, body: JSON.stringify({ from: env.EMAIL_FROM, to: row.recipient, subject: message.subject, text: message.body, html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${safe(message.body)}</pre>` }), signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`E-mail refusé par le fournisseur (HTTP ${response.status}).`)
}
async function sendWhatsApp(row: OutboxRow) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) throw new Error('WhatsApp Business Cloud non configuré.')
  const payload = row.payload
  const templateName = row.templateKey === 'contact_message' ? env.WHATSAPP_TEMPLATE_CONTACT_MESSAGE : row.templateKey === 'booking_reminder' ? env.WHATSAPP_TEMPLATE_BOOKING_REMINDER : row.templateKey === 'booking_payment_received' ? env.WHATSAPP_TEMPLATE_PAYMENT_RECEIVED : row.templateKey === 'payment_manual_review' ? env.WHATSAPP_TEMPLATE_PAYMENT_REVIEW : row.templateKey === 'booking_recovery_code' ? env.WHATSAPP_TEMPLATE_BOOKING_RECOVERY : env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED
  if (!templateName) throw new Error('Modèle WhatsApp approuvé correspondant non configuré.')
  const parameters = row.templateKey === 'booking_recovery_code' ? [text(payload.code), text(payload.expiresMinutes ?? '10')] : row.templateKey === 'contact_message' ? [text(payload.name), text(payload.phone) || text(payload.email), text(payload.message).slice(0, 900)] : row.templateKey === 'booking_payment_received' ? [text(payload.reference), Number(payload.paymentXof ?? 0).toLocaleString('fr-BJ'), Number(payload.depositPaidXof ?? 0).toLocaleString('fr-BJ'), Number(payload.remainingXof ?? 0).toLocaleString('fr-BJ')] : row.templateKey === 'payment_manual_review' ? [text(payload.reference), Number(payload.paymentXof ?? 0).toLocaleString('fr-BJ'), text(payload.currency), text(payload.reason)] : [text(payload.reference), text(payload.startsAt), Number(payload.totalXof ?? 0).toLocaleString('fr-BJ'), Number(payload.depositPaidXof ?? 0).toLocaleString('fr-BJ'), Number(payload.remainingXof ?? 0).toLocaleString('fr-BJ')]
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION || 'v22.0'}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`
  const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: row.recipient.replace(/\D/g, ''), type: 'template', template: { name: templateName, language: { code: 'fr' }, components: [{ type: 'body', parameters: parameters.map((value) => ({ type: 'text', text: value })) }] } }), signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`WhatsApp Cloud a refusé le message (HTTP ${response.status}).`)
}
async function deliver(row: OutboxRow) { if (row.channel === 'email') return sendEmail(row); if (row.channel === 'whatsapp') return sendWhatsApp(row); throw new Error('Canal de notification non reconnu.') }

export async function dispatchNotificationOutbox(limit = 20) {
  const db = getDatabase(), now = new Date(), staleBefore = new Date(now.getTime() - 5 * 60_000)
  await db.update(notificationOutbox).set({ status: 'failed', lastError: 'Envoi interrompu après cinq tentatives ; contrôle manuel requis.', updatedAt: now }).where(and(eq(notificationOutbox.status, 'sending'), lte(notificationOutbox.updatedAt, staleBefore), gte(notificationOutbox.attempts, 5)))
  const batch = await db.transaction(async (tx) => {
    const rows = await tx.select().from(notificationOutbox).where(and(
      or(inArray(notificationOutbox.status, ['queued', 'retry']), and(eq(notificationOutbox.status, 'sending'), lte(notificationOutbox.updatedAt, staleBefore), lt(notificationOutbox.attempts, 5))),
      lte(notificationOutbox.nextAttemptAt, now),
    )).orderBy(notificationOutbox.nextAttemptAt).limit(Math.min(50, Math.max(1, limit))).for('update', { skipLocked: true })
    const claimed: OutboxRow[] = []
    for (const row of rows) {
      const [updated] = await tx.update(notificationOutbox).set({ status: 'sending', attempts: sql`${notificationOutbox.attempts} + 1`, updatedAt: now }).where(eq(notificationOutbox.id, row.id)).returning()
      if (updated) claimed.push(updated)
    }
    return claimed
  })
  let sent = 0, failed = 0
  for (const row of batch) {
    let failure: string | null = null
    let permanentlyFailed = false
    try {
      if (row.templateKey === 'booking_recovery_code') {
        const challengeId = row.dedupeKey.split(':')[1] || ''
        const [challenge] = await db.select({ expiresAt: guestRecoveryChallenges.expiresAt, consumedAt: guestRecoveryChallenges.consumedAt }).from(guestRecoveryChallenges).where(eq(guestRecoveryChallenges.id, challengeId)).limit(1)
        if (!text(row.payload.code) || !challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) { failure = 'Code de récupération absent, expiré ou déjà utilisé.'; permanentlyFailed = true }
      }
      if (!failure) await deliver(row)
    } catch (error) { failure = error instanceof Error ? error.message : 'Échec du fournisseur externe.' }
    const attempts = row.attempts, status = failure ? (permanentlyFailed || attempts >= 5 ? 'failed' : 'retry') : 'sent', delayMinutes = Math.min(24, 2 ** Math.min(attempts, 10))
    await db.transaction(async (tx) => {
      await tx.update(notificationOutbox).set({ status, nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000), lastError: failure, ...(row.templateKey === 'booking_recovery_code' && (!failure || status === 'failed') ? { payload: { reference: text(row.payload.reference) } } : {}), updatedAt: new Date() }).where(and(eq(notificationOutbox.id, row.id), eq(notificationOutbox.status, 'sending')))
      await tx.insert(notificationLogs).values({ salonId: row.salonId, outboxId: row.id, channel: row.channel, recipient: row.templateKey === 'booking_recovery_code' ? '[masqué]' : row.recipient, status, error: failure })
    })
    if (failure) failed++; else sent++
  }
  return { claimed: batch.length, sent, failed }
}
