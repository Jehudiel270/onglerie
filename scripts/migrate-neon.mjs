// Migrations Drizzle via le client WebSocket Neon (connexion directe).
// Contexte : `drizzle-kit migrate` utilise pg sur le port TCP 5432, indisponible
// dans certains environnements restreints (le flux y est bloqué après le handshake).
// Ce script obtient le même résultat via le transport WebSocket du driver Neon,
// en exécutant la même journalisation drizzle (__drizzle_migrations).
// Usage : NEON_DATABASE_URL_UNPOOLED=... node scripts/migrate-neon.mjs
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
import { env } from 'node:process'
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { migrate } from 'drizzle-orm/neon-serverless/migrator'

const url = env.NEON_DATABASE_URL_UNPOOLED || env.NEON_DATABASE_URL
if (!url) {
  console.error('Définissez NEON_DATABASE_URL_UNPOOLED (connexion directe, sans -pooler) pour cette commande.')
  process.exit(1)
}
if (/-pooler\./.test(url)) {
  console.error('Refusé : cette URL est poolée. Les migrations exigent la connexion directe (hôte sans « -pooler »).')
  process.exit(1)
}

const pool = new Pool({ connectionString: url, max: 1 })
pool.on('error', (e) => console.error('Pool :', e.message ?? e))

try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: './server/db/migrations' })
  console.log('Migrations appliquées (transport WebSocket direct).')
  const journal = await pool.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'drizzle'",
  )
  const applied = await pool.query('select count(*)::int as n from drizzle.__drizzle_migrations')
  const tables = await pool.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  )
  console.log(`Tables schéma drizzle : ${journal.rows[0]?.n ?? 0} — migrations enregistrées : ${applied.rows[0]?.n ?? 0}`)
  console.log(`Tables métier (public) : ${tables.rows.length}`)
} catch (e) {
  console.error('Échec des migrations :', e.message ?? e)
  process.exitCode = 1
} finally {
  try { await pool.end() } catch {}
}
