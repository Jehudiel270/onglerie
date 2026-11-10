import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  time,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()

// Better Auth tables (PostgreSQL adapter).
export const users = pgTable('user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(), image: text('image'), role: text('role').default('customer').notNull(),
  createdAt: createdAt(), updatedAt: updatedAt(),
})
export const sessions = pgTable('session', {
  id: text('id').primaryKey(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), token: text('token').notNull().unique(),
  createdAt: createdAt(), updatedAt: updatedAt(), ipAddress: text('ip_address'), userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [index('session_user_id_idx').on(table.userId)])
export const accounts = pgTable('account', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), accessToken: text('access_token'),
  refreshToken: text('refresh_token'), idToken: text('id_token'), accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }), scope: text('scope'), password: text('password'),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index('account_user_id_idx').on(table.userId)])
export const verifications = pgTable('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index('verification_identifier_idx').on(table.identifier)])
export const salons = pgTable('salons', {
  id: uuid('id').defaultRandom().primaryKey(), name: text('name').notNull(), slug: text('slug').notNull().unique(), description: text('description'),
  status: text('status').default('setup').notNull(), timezone: text('timezone').default('Africa/Porto-Novo').notNull(), currency: text('currency').default('XOF').notNull(),
  phone: text('phone'), whatsapp: text('whatsapp'), email: text('email'), address: text('address'), city: text('city'), instagram: text('instagram'), country: text('country').default('BJ').notNull(),
  createdAt: createdAt(), updatedAt: updatedAt(),
})
export const salonMemberships = pgTable('salon_memberships', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), role: text('role').default('staff').notNull(),
  active: boolean('active').default(true).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex('salon_membership_unique').on(table.salonId, table.userId), index('salon_membership_user_idx').on(table.userId)])
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), slug: text('slug').notNull(), kind: text('kind').default('service').notNull(), description: text('description'), imageUrl: text('image_url'),
  position: integer('position').default(0).notNull(), active: boolean('active').default(true).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex('category_salon_slug_unique').on(table.salonId, table.slug), index('category_salon_kind_idx').on(table.salonId, table.kind)])
export const services = pgTable('services', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }), name: text('name').notNull(), slug: text('slug').notNull(), description: text('description').notNull(), details: text('details'),
  priceXof: integer('price_xof').notNull(), durationMinutes: integer('duration_minutes').notNull(), preparationMinutes: integer('preparation_minutes').default(0).notNull(),
  depositXof: integer('deposit_xof').default(0).notNull(), imageUrl: text('image_url'), conditions: text('conditions'), active: boolean('active').default(true).notNull(),
  featured: boolean('featured').default(false).notNull(), position: integer('position').default(0).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex('service_salon_slug_unique').on(table.salonId, table.slug), index('service_salon_active_position_idx').on(table.salonId, table.active, table.position)])
export const staff = pgTable('staff', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), firstName: text('first_name').notNull(), lastName: text('last_name'), bio: text('bio'), imageUrl: text('image_url'),
  active: boolean('active').default(true).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index('staff_salon_active_idx').on(table.salonId, table.active)])
export const staffServices = pgTable('staff_services', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }), serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
}, (table) => [uniqueIndex('staff_service_unique').on(table.staffId, table.serviceId)])
export const staffSchedules = pgTable('staff_schedules', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }), weekday: integer('weekday').notNull(), opensAt: time('opens_at').notNull(), closesAt: time('closes_at').notNull(),
  breakStartsAt: time('break_starts_at'), breakEndsAt: time('break_ends_at'), active: boolean('active').default(true).notNull(),
}, (table) => [index('schedule_salon_day_idx').on(table.salonId, table.weekday)])
export const scheduleExceptions = pgTable('schedule_exceptions', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }), startsAt: timestamp('starts_at', { withTimezone: true }).notNull(), endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  kind: text('kind').notNull(), note: text('note'), createdAt: createdAt(),
}, (table) => [index('schedule_exception_period_idx').on(table.salonId, table.startsAt, table.endsAt)])
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), firstName: text('first_name').notNull(), lastName: text('last_name').notNull(),
  phone: text('phone').notNull(), whatsapp: text('whatsapp'), email: text('email'), adminNote: text('admin_note'), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex('customer_salon_phone_unique').on(table.salonId, table.phone), index('customer_salon_name_idx').on(table.salonId, table.lastName, table.firstName)])
export const portfolioItems = pgTable('portfolio_items', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }), serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(), title: text('title').notNull(), description: text('description'), style: text('style'), color: text('color'), shape: text('shape'), length: text('length'), technique: text('technique'),
  imageUrls: jsonb('image_urls').$type<string[]>().default(sql`'[]'::jsonb`).notNull(), published: boolean('published').default(false).notNull(), featured: boolean('featured').default(false).notNull(), trend: boolean('trend').default(false).notNull(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex('portfolio_salon_slug_unique').on(table.salonId, table.slug), index('portfolio_salon_published_idx').on(table.salonId, table.published, table.createdAt)])
export const portfolioTags = pgTable('portfolio_tags', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }), name: text('name').notNull(), slug: text('slug').notNull(),
}, (table) => [uniqueIndex('portfolio_tag_salon_slug_unique').on(table.salonId, table.slug)])
export const portfolioItemTags = pgTable('portfolio_item_tags', {
  portfolioItemId: uuid('portfolio_item_id').notNull().references(() => portfolioItems.id, { onDelete: 'cascade' }), tagId: uuid('tag_id').notNull().references(() => portfolioTags.id, { onDelete: 'cascade' }),
}, (table) => [uniqueIndex('portfolio_item_tag_unique').on(table.portfolioItemId, table.tagId)])
export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }), staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'set null' }),
  referencePortfolioId: uuid('reference_portfolio_id').references(() => portfolioItems.id, { onDelete: 'set null' }), reference: text('reference').notNull().unique(),
  idempotencyKey: text('idempotency_key').unique(),
  guestAccessTokenHash: text('guest_access_token_hash').unique(), guestAccessExpiresAt: timestamp('guest_access_expires_at', { withTimezone: true }),
  status: text('status').default('pending_payment').notNull(), startsAt: timestamp('starts_at', { withTimezone: true }).notNull(), endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }), totalXof: integer('total_xof').notNull(), depositDueXof: integer('deposit_due_xof').notNull(), amountPaidXof: integer('amount_paid_xof').default(0).notNull(),
  customerNote: text('customer_note'), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index('appointment_salon_start_idx').on(table.salonId, table.startsAt), index('appointment_staff_period_idx').on(table.staffId, table.startsAt, table.endsAt), index('appointment_pending_expiry_idx').on(table.status, table.expiresAt)])
export const guestRecoveryChallenges = pgTable('guest_recovery_challenges', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }), codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').default(0).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }), createdAt: createdAt(),
}, (table) => [index('guest_recovery_appointment_created_idx').on(table.appointmentId, table.createdAt), index('guest_recovery_expiry_idx').on(table.expiresAt)])
export const appointmentServices = pgTable('appointment_services', {
  id: uuid('id').defaultRandom().primaryKey(), appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'restrict' }), serviceNameSnapshot: text('service_name_snapshot').notNull(), priceSnapshotXof: integer('price_snapshot_xof').notNull(), durationSnapshotMinutes: integer('duration_snapshot_minutes').notNull(),
}, (table) => [index('appointment_services_appointment_idx').on(table.appointmentId)])
export const appointmentStatusHistory = pgTable('appointment_status_history', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }), fromStatus: text('from_status'), toStatus: text('to_status').notNull(), actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }), reason: text('reason'), createdAt: createdAt(),
}, (table) => [index('appointment_history_appointment_idx').on(table.appointmentId, table.createdAt)])
export const customerAppointmentRequests = pgTable('customer_appointment_requests', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }), customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), requestedFor: timestamp('requested_for', { withTimezone: true }), message: text('message'), status: text('status').default('open').notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index('customer_appointment_requests_idx').on(table.salonId, table.status, table.createdAt)])
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }), appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), providerReference: text('provider_reference'), amountXof: integer('amount_xof').notNull(), currency: text('currency').default('XOF').notNull(), method: text('method'), status: text('status').default('pending').notNull(),
  reconciled: boolean('reconciled').default(false).notNull(), paidAt: timestamp('paid_at', { withTimezone: true }), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex('payment_provider_reference_unique').on(table.provider, table.providerReference), index('payment_salon_status_idx').on(table.salonId, table.status, table.createdAt), index('payment_appointment_idx').on(table.appointmentId)])
export const paymentWebhookEvents = pgTable('payment_webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(), provider: text('provider').notNull(), eventReference: text('event_reference').notNull(), eventType: text('event_type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(), status: text('status').default('received').notNull(), receivedAt: createdAt(), processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => [uniqueIndex('payment_webhook_provider_event_unique').on(table.provider, table.eventReference)])
export const salonSettings = pgTable('salon_settings', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }).unique(), settings: jsonb('settings').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
})
// Configuration plateforme (clés d'intégration) : repli éditable depuis le
// panneau développement. Une variable d'environnement du même nom reste
// prioritaire ; les valeurs ne sont jamais renvoyées en clair par l'API.
export const platformConfig = pgTable('platform_config', {
  key: text('key').primaryKey(), value: text('value').notNull(), updatedAt: updatedAt(),
})
export const siteContent = pgTable('site_content', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }), contentKey: text('content_key').notNull(), content: jsonb('content').$type<Record<string, unknown>>().notNull(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex('site_content_key_unique').on(table.salonId, table.contentKey)])
export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }), name: text('name').notNull(), phone: text('phone'), email: text('email'), message: text('message').notNull(), status: text('status').default('new').notNull(), createdAt: createdAt(),
}, (table) => [index('contact_message_salon_created_idx').on(table.salonId, table.createdAt)])
export const notificationOutbox = pgTable('notification_outbox', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }), dedupeKey: text('dedupe_key').notNull().unique(), recipient: text('recipient').notNull(), channel: text('channel').notNull(), templateKey: text('template_key').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(), status: text('status').default('queued').notNull(), attempts: integer('attempts').default(0).notNull(), nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(), lastError: text('last_error'), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index('notification_outbox_ready_idx').on(table.status, table.nextAttemptAt)])
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }), outboxId: uuid('outbox_id').references(() => notificationOutbox.id, { onDelete: 'set null' }), channel: text('channel').notNull(), recipient: text('recipient').notNull(), status: text('status').notNull(), error: text('error'), attemptedAt: createdAt(),
}, (table) => [index('notification_logs_salon_attempt_idx').on(table.salonId, table.attemptedAt)])
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(), salonId: uuid('salon_id').references(() => salons.id, { onDelete: 'cascade' }), userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), action: text('action').notNull(), entity: text('entity').notNull(), entityId: text('entity_id'), metadata: jsonb('metadata').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(), ipAddress: text('ip_address'), createdAt: createdAt(),
}, (table) => [index('audit_salon_created_idx').on(table.salonId, table.createdAt)])
export const apiRateLimits = pgTable('api_rate_limits', {
  bucketKey: text('bucket_key').primaryKey(), count: integer('count').notNull(), resetAt: timestamp('reset_at', { withTimezone: true }).notNull(), updatedAt: updatedAt(),
}, (table) => [index('api_rate_limit_reset_idx').on(table.resetAt)])
export const schema = { users, sessions, accounts, verifications, salons, salonMemberships, categories, services, staff, staffServices, staffSchedules, scheduleExceptions, customers, portfolioItems, portfolioTags, portfolioItemTags, appointments, guestRecoveryChallenges, appointmentServices, appointmentStatusHistory, customerAppointmentRequests, payments, paymentWebhookEvents, salonSettings, siteContent, contactMessages, notificationOutbox, notificationLogs, auditLogs, apiRateLimits }
