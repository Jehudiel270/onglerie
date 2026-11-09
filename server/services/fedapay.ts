import { createHash } from 'node:crypto'
import { env } from 'node:process'
import { FedaPay, Transaction, Webhook } from 'fedapay'
import { and, eq, gt, isNull, lt, ne, or, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { formatInTimeZone } from 'date-fns-tz'
import { SALON_TIMEZONE } from '~~/shared/constants/business'
import { getDatabase } from '../db/client'
import {
  appointmentStatusHistory,
  appointments,
  customers,
  notificationOutbox,
  paymentWebhookEvents,
  payments,
  salons,
} from '../db/schema'

const paidProviderStatuses = new Set(['approved', 'transferred'])
const finalEventStatuses = new Set([
  'paid_reconciled',
  'payment_manual_review',
  'amount_currency_mismatch',
])

export function isFedaPayConfigured(): boolean {
  return Boolean(env.FEDAPAY_SECRET_KEY && env.FEDAPAY_WEBHOOK_SECRET)
}

function configureFedaPay(): void {
  if (!env.FEDAPAY_SECRET_KEY) {
    throw createError({ statusCode: 503, statusMessage: 'Le paiement FedaPay n’est pas configuré.' })
  }
  FedaPay.setApiKey(env.FEDAPAY_SECRET_KEY)
  FedaPay.setEnvironment(env.FEDAPAY_ENV === 'production' ? 'production' : 'sandbox')
}

export async function createDepositCheckout(input: {
  salonId: string
  bookingId: string
  reference: string
  amountXof: number
  firstName: string
  lastName: string
  phone: string
  email?: string | null
  callbackUrl: string
}) {
  if (!isFedaPayConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Configurez la clé FedaPay et le secret du webhook avant d’activer les paiements.' })
  }

  configureFedaPay()
  const transaction = await Transaction.create({
    description: `Acompte réservation ${input.reference}`,
    amount: input.amountXof,
    currency: { iso: 'XOF' },
    callback_url: input.callbackUrl,
    customer: {
      firstname: input.firstName,
      lastname: input.lastName,
      email: input.email || undefined,
      phone_number: { number: input.phone, country: 'bj' },
    },
  })
  const token = await transaction.generateToken()
  const checkoutUrl = typeof token.url === 'string' ? new URL(token.url) : null
  const isFedaPayHost = checkoutUrl && (
    checkoutUrl.hostname === 'fedapay.com' || checkoutUrl.hostname.endsWith('.fedapay.com')
  )
  if (!checkoutUrl || checkoutUrl.protocol !== 'https:' || !isFedaPayHost) {
    throw createError({ statusCode: 502, statusMessage: 'FedaPay n’a pas renvoyé de lien de paiement sûr.' })
  }

  const db = getDatabase()
  const [salon] = await db.select({ id: salons.id }).from(salons).where(eq(salons.id, input.salonId)).limit(1)
  if (!salon) throw createError({ statusCode: 404, statusMessage: 'Salon introuvable pour associer le paiement.' })

  const [payment] = await db.insert(payments).values({
    salonId: input.salonId,
    appointmentId: input.bookingId,
    provider: 'fedapay',
    providerReference: String(transaction.id),
    amountXof: input.amountXof,
    currency: 'XOF',
    status: 'pending',
  }).returning()
  if (!payment) throw createError({ statusCode: 500, statusMessage: 'Impossible d’enregistrer le paiement en attente.' })

  return { checkoutUrl: checkoutUrl.toString(), providerReference: String(transaction.id), paymentId: payment.id }
}

export function verifyFedaPayWebhook(rawBody: string, signature: string | null): Record<string, unknown> {
  if (!env.FEDAPAY_WEBHOOK_SECRET) {
    throw createError({ statusCode: 503, statusMessage: 'Le webhook FedaPay n’est pas configuré.' })
  }
  if (!signature || !rawBody) throw createError({ statusCode: 400, statusMessage: 'Signature FedaPay absente.' })
  try {
    return Webhook.constructEvent(rawBody, signature, env.FEDAPAY_WEBHOOK_SECRET, 300) as Record<string, unknown>
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Signature FedaPay invalide ou expirée.' })
  }
}

function eventData(eventType: string, providerTransactionId: string, remote: unknown) {
  const record = remote as Record<string, unknown>
  const currencyValue = record.currency
  const currency = typeof currencyValue === 'string'
    ? currencyValue
    : String((currencyValue as Record<string, unknown> | undefined)?.iso ?? '')
  return {
    eventType,
    currency,
    remoteAmountXof: Number(record.amount),
    remoteStatus: String(record.status ?? ''),
    providerTransactionId,
  }
}

export async function reconcileFedaPayWebhook(payload: Record<string, unknown>, rawBody: string) {
  configureFedaPay()
  const rawEntity = (payload.entity ?? payload.data ?? payload.object) as Record<string, unknown> | undefined
  const providerId = rawEntity?.id ?? (rawEntity?.object as Record<string, unknown> | undefined)?.id
  if (providerId === undefined || providerId === null) {
    throw createError({ statusCode: 400, statusMessage: 'Événement FedaPay sans transaction.' })
  }

  const providerTransactionId = String(providerId)
  const eventType = String(payload.name ?? payload.type ?? 'unknown')
  const eventReference = String(payload.id ?? createHash('sha256').update(rawBody).digest('hex'))
  const db = getDatabase()

  // Provider lookups happen before the event is acknowledged locally. A transient API failure
  // therefore leaves no consumed idempotency key and the signed webhook can safely be retried.
  const [payment] = await db.select().from(payments).where(and(
    eq(payments.provider, 'fedapay'),
    eq(payments.providerReference, providerTransactionId),
  )).limit(1)
  if (!payment) {
    throw createError({ statusCode: 503, statusMessage: 'Le paiement FedaPay correspondant n’est pas encore disponible pour rapprochement.' })
  }

  const remote = await Transaction.retrieve(providerTransactionId, { include: 'currency,customer' })
  const verified = eventData(eventType, providerTransactionId, remote)
  const isPaid = paidProviderStatuses.has(verified.remoteStatus)
  const matchesRecordedPayment = verified.remoteAmountXof === payment.amountXof
    && verified.currency === 'XOF'
    && payment.currency === 'XOF'

  return db.transaction(async (tx) => {
    // Serialize duplicate deliveries even while an event row does not yet exist.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`fedapay:${eventReference}`}), 0)`)

    const [existingEvent] = await tx.select().from(paymentWebhookEvents).where(and(
      eq(paymentWebhookEvents.provider, 'fedapay'),
      eq(paymentWebhookEvents.eventReference, eventReference),
    )).for('update').limit(1)

    if (existingEvent && finalEventStatuses.has(existingEvent.status)) {
      const previousRemoteStatus = String(existingEvent.payload.remoteStatus ?? '')
      const previouslyPaid = existingEvent.status === 'paid_reconciled'
        || existingEvent.status === 'payment_manual_review'
        || (existingEvent.status === 'amount_currency_mismatch' && paidProviderStatuses.has(previousRemoteStatus))
      return {
        received: true,
        duplicate: true,
        paid: previouslyPaid,
        matched: existingEvent.status === 'paid_reconciled',
        reviewRequired: existingEvent.status !== 'paid_reconciled',
      }
    }

    const storedPayload = {
      providerTransactionId,
      remoteStatus: verified.remoteStatus,
      remoteAmountXof: verified.remoteAmountXof,
      remoteCurrency: verified.currency,
    }
    let eventId = existingEvent?.id
    if (!eventId) {
      const [createdEvent] = await tx.insert(paymentWebhookEvents).values({
        provider: 'fedapay',
        eventReference,
        eventType,
        payload: storedPayload,
        status: 'processing',
      }).onConflictDoNothing().returning({ id: paymentWebhookEvents.id })
      eventId = createdEvent?.id
    }
    if (!eventId) {
      throw createError({ statusCode: 503, statusMessage: 'L’événement FedaPay n’a pas pu être réservé pour traitement.' })
    }

    const now = new Date()
    if (!matchesRecordedPayment) {
      const status = isPaid ? 'paid_manual_review' : 'amount_currency_mismatch'
      await tx.update(paymentWebhookEvents).set({
        payload: { ...storedPayload, reviewReason: 'amount_or_currency_mismatch' },
        status: 'amount_currency_mismatch',
        processedAt: now,
      }).where(eq(paymentWebhookEvents.id, eventId))
      await tx.update(payments).set({
        status,
        reconciled: false,
        paidAt: isPaid ? now : payment.paidAt,
        updatedAt: now,
      }).where(eq(payments.id, payment.id))

      if (isPaid) {
        const [appointment] = await tx.select().from(appointments)
          .where(eq(appointments.id, payment.appointmentId)).for('update').limit(1)
        const [salon] = await tx.select().from(salons).where(eq(salons.id, payment.salonId)).limit(1)
        const details = {
          reference: appointment?.reference ?? payment.appointmentId,
          startsAt: appointment?.startsAt.toISOString() ?? '',
          paymentXof: verified.remoteAmountXof,
          currency: verified.currency,
          reason: 'amount_or_currency_mismatch',
          providerReference: providerTransactionId,
        }
        if (salon?.email) {
          await tx.insert(notificationOutbox).values({
            salonId: payment.salonId,
            dedupeKey: `${payment.id}:amount-mismatch:email:owner`,
            recipient: salon.email,
            channel: 'email',
            templateKey: 'payment_manual_review',
            payload: details,
          }).onConflictDoNothing()
        }
        if (salon?.whatsapp) {
          await tx.insert(notificationOutbox).values({
            salonId: payment.salonId,
            dedupeKey: `${payment.id}:amount-mismatch:whatsapp:owner`,
            recipient: salon.whatsapp,
            channel: 'whatsapp',
            templateKey: 'payment_manual_review',
            payload: details,
          }).onConflictDoNothing()
        }
      }

      return { received: true, paid: isPaid, matched: false, reviewRequired: true, reason: 'amount_or_currency_mismatch' }
    }

    if (!isPaid) {
      await tx.update(paymentWebhookEvents).set({
        payload: storedPayload,
        status: 'verified_not_paid',
        processedAt: now,
      }).where(eq(paymentWebhookEvents.id, eventId))
      if (!payment.reconciled && ['declined', 'canceled', 'cancelled', 'failed'].includes(verified.remoteStatus.toLowerCase())) {
        await tx.update(payments).set({ status: 'failed', updatedAt: now }).where(eq(payments.id, payment.id))
      }
      return { received: true, paid: false, matched: true }
    }

    const [lockedPayment] = await tx.select().from(payments).where(eq(payments.id, payment.id)).for('update').limit(1)
    if (!lockedPayment) throw createError({ statusCode: 503, statusMessage: 'Le paiement local a disparu pendant le rapprochement.' })
    if (lockedPayment.reconciled) {
      await tx.update(paymentWebhookEvents).set({ status: 'paid_reconciled', processedAt: now }).where(eq(paymentWebhookEvents.id, eventId))
      return { received: true, duplicate: true, paid: true, matched: true }
    }

    const [appointment] = await tx.select().from(appointments).where(eq(appointments.id, lockedPayment.appointmentId)).for('update').limit(1)
    if (!appointment) {
      await tx.update(payments).set({ status: 'paid_manual_review', reconciled: false, paidAt: now, updatedAt: now }).where(eq(payments.id, lockedPayment.id))
      await tx.update(paymentWebhookEvents).set({ status: 'payment_manual_review', processedAt: now }).where(eq(paymentWebhookEvents.id, eventId))
      return { received: true, paid: true, matched: false, reviewRequired: true }
    }

    const holdExpired = appointment.status === 'pending_payment'
      && (!appointment.expiresAt || appointment.expiresAt <= now)
    if (holdExpired) {
      await tx.update(appointments).set({ status: 'expired', expiresAt: null, updatedAt: now }).where(eq(appointments.id, appointment.id))
      await tx.insert(appointmentStatusHistory).values({
        salonId: appointment.salonId,
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: 'expired',
        reason: 'La retenue a expiré avant la vérification du paiement FedaPay.',
      })
    }

    let scheduleReviewReason = appointment.startsAt <= now ? 'appointment_start_passed' : ''
    if (appointment.status === 'pending_payment' && !holdExpired && !scheduleReviewReason) {
      if (!appointment.staffId) scheduleReviewReason = 'staff_not_assigned'
      else {
        const localDate = formatInTimeZone(appointment.startsAt, SALON_TIMEZONE, 'yyyy-MM-dd')
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${appointment.salonId}:${appointment.staffId}:${localDate}`}), 0)`)
        const [overlap] = await tx.select({ id: appointments.id }).from(appointments).where(and(
          eq(appointments.salonId, appointment.salonId), eq(appointments.staffId, appointment.staffId),
          ne(appointments.id, appointment.id), lt(appointments.startsAt, appointment.endsAt), gt(appointments.endsAt, appointment.startsAt),
          or(eq(appointments.status, 'confirmed'), and(eq(appointments.status, 'pending_payment'), or(isNull(appointments.expiresAt), gt(appointments.expiresAt, now)))),
        )).limit(1)
        if (overlap) scheduleReviewReason = 'staff_time_overlap'
      }
    }
    if (appointment.status === 'pending_payment' && !holdExpired && scheduleReviewReason) {
      await tx.update(appointments).set({ status: 'expired', expiresAt: null, updatedAt: now }).where(eq(appointments.id, appointment.id))
      await tx.insert(appointmentStatusHistory).values({ salonId: appointment.salonId, appointmentId: appointment.id, fromStatus: 'pending_payment', toStatus: 'expired', reason: `Le paiement est arrivé sans créneau confirmable (${scheduleReviewReason}); revue manuelle requise.` })
    }

    const paymentReviewReason = holdExpired ? 'hold_expired' : scheduleReviewReason || (['cancelled', 'expired', 'payment_failed'].includes(appointment.status) ? `appointment_${appointment.status}` : 'appointment_not_payable')
    const bookingCanAcceptPayment = ['pending_payment', 'confirmed'].includes(appointment.status) && !holdExpired && !scheduleReviewReason
    if (!bookingCanAcceptPayment) {
      await tx.update(payments).set({
        status: 'paid_manual_review',
        reconciled: false,
        paidAt: now,
        updatedAt: now,
      }).where(eq(payments.id, lockedPayment.id))
      await tx.update(paymentWebhookEvents).set({
        payload: { ...storedPayload, reviewReason: paymentReviewReason },
        status: 'payment_manual_review',
        processedAt: now,
      }).where(eq(paymentWebhookEvents.id, eventId))

      const [salon] = await tx.select().from(salons).where(eq(salons.id, appointment.salonId)).limit(1)
      const details = {
        reference: appointment.reference,
        startsAt: appointment.startsAt.toISOString(),
        paymentXof: verified.remoteAmountXof,
        currency: verified.currency,
        reason: paymentReviewReason,
        providerReference: providerTransactionId,
      }
      if (salon?.email) {
        await tx.insert(notificationOutbox).values({
          salonId: appointment.salonId,
          dedupeKey: `${lockedPayment.id}:late-payment:email:owner`,
          recipient: salon.email,
          channel: 'email',
          templateKey: 'payment_manual_review',
          payload: details,
        }).onConflictDoNothing()
      }
      if (salon?.whatsapp) {
        await tx.insert(notificationOutbox).values({
          salonId: appointment.salonId,
          dedupeKey: `${lockedPayment.id}:late-payment:whatsapp:owner`,
          recipient: salon.whatsapp,
          channel: 'whatsapp',
          templateKey: 'payment_manual_review',
          payload: details,
        }).onConflictDoNothing()
      }
      return { received: true, paid: true, matched: false, reviewRequired: true }
    }

    const nextPaid = appointment.amountPaidXof + lockedPayment.amountXof
    const confirmsPendingBooking = appointment.status === 'pending_payment' && nextPaid >= appointment.depositDueXof
    const nextStatus = confirmsPendingBooking ? 'confirmed' : appointment.status
    await tx.update(payments).set({ status: 'paid', reconciled: true, paidAt: now, updatedAt: now })
      .where(eq(payments.id, lockedPayment.id))
    await tx.update(appointments).set({
      amountPaidXof: nextPaid,
      status: nextStatus,
      expiresAt: confirmsPendingBooking ? null : appointment.expiresAt,
      updatedAt: now,
    }).where(eq(appointments.id, appointment.id))

    if (confirmsPendingBooking) {
      await tx.insert(appointmentStatusHistory).values({
        salonId: appointment.salonId,
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: 'confirmed',
        reason: 'Acompte vérifié auprès de FedaPay après webhook signé.',
      })
    }

    const [customer] = await tx.select().from(customers).where(and(
      eq(customers.id, appointment.customerId),
      eq(customers.salonId, appointment.salonId),
    )).limit(1)
    const [salon] = await tx.select().from(salons).where(eq(salons.id, appointment.salonId)).limit(1)
    const summary = {
      appointmentId: appointment.id,
      reference: appointment.reference,
      startsAt: appointment.startsAt.toISOString(),
      totalXof: appointment.totalXof,
      paymentXof: lockedPayment.amountXof,
      depositPaidXof: nextPaid,
      remainingXof: Math.max(0, appointment.totalXof - nextPaid),
    }

    if (customer?.phone) {
      await tx.insert(notificationOutbox).values({
        salonId: appointment.salonId,
        dedupeKey: `${lockedPayment.id}:payment-received:whatsapp:customer`,
        recipient: customer.whatsapp || customer.phone,
        channel: 'whatsapp',
        templateKey: 'booking_payment_received',
        payload: summary,
      }).onConflictDoNothing()
    }
    if (customer?.email) {
      await tx.insert(notificationOutbox).values({
        salonId: appointment.salonId,
        dedupeKey: `${lockedPayment.id}:payment-received:email:customer`,
        recipient: customer.email,
        channel: 'email',
        templateKey: 'booking_payment_received',
        payload: summary,
      }).onConflictDoNothing()
    }
    if (salon?.email) {
      await tx.insert(notificationOutbox).values({
        salonId: appointment.salonId,
        dedupeKey: `${lockedPayment.id}:payment-received:email:owner`,
        recipient: salon.email,
        channel: 'email',
        templateKey: 'booking_payment_received',
        payload: summary,
      }).onConflictDoNothing()
    }

    if (confirmsPendingBooking) {
      if (customer?.phone) {
        await tx.insert(notificationOutbox).values({
          salonId: appointment.salonId,
          dedupeKey: `${appointment.id}:confirmed:whatsapp:customer`,
          recipient: customer.whatsapp || customer.phone,
          channel: 'whatsapp',
          templateKey: 'booking_confirmed',
          payload: summary,
        }).onConflictDoNothing()
      }
      if (customer?.email) {
        await tx.insert(notificationOutbox).values({
          salonId: appointment.salonId,
          dedupeKey: `${appointment.id}:confirmed:email:customer`,
          recipient: customer.email,
          channel: 'email',
          templateKey: 'booking_confirmed',
          payload: summary,
        }).onConflictDoNothing()
      }
      if (salon?.email) {
        await tx.insert(notificationOutbox).values({
          salonId: appointment.salonId,
          dedupeKey: `${appointment.id}:confirmed:email:salon`,
          recipient: salon.email,
          channel: 'email',
          templateKey: 'booking_confirmed_owner',
          payload: summary,
        }).onConflictDoNothing()
      }
    }

    await tx.update(paymentWebhookEvents).set({
      payload: storedPayload,
      status: 'paid_reconciled',
      processedAt: now,
    }).where(eq(paymentWebhookEvents.id, eventId))
    return { received: true, paid: true, matched: true, confirmed: confirmsPendingBooking }
  })
}
