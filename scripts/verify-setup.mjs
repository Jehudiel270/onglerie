// Diagnostic post-installation : migrations, tables, compte propriétaire,
// salon et réglages. Lecture seule, aucun secret affiché.
// Usage : node scripts/verify-setup.mjs (requiert NEON_DATABASE_URL[_UNPOOLED] dans l'environnement).
import 'dotenv/config'
import { Pool } from '@neondatabase/serverless'

const url = process.env.NEON_DATABASE_URL_UNPOOLED || process.env.NEON_DATABASE_URL
if (!url) { console.error('URL Neon manquante.'); process.exit(1) }
const pool = new Pool({ connectionString: url, max: 1 })

const q = async (sql, params) => (await pool.query(sql, params)).rows

try {
  const migrations = await q('select count(*)::int as n from drizzle.__drizzle_migrations')
  const tables = await q("select table_name from information_schema.tables where table_schema='public' order by table_name")
  console.log(`▶ Migrations enregistrées : ${migrations[0].n}`)
  console.log(`▶ Tables métier : ${tables.length}`)
  console.log('   ' + tables.map(t => t.table_name).join(', '))

  const users = await q('select id, name, email, role, email_verified from "user" order by created_at')
  console.log(`▶ Utilisateurs : ${users.length}`)
  for (const u of users) {
    console.log(`   - ${u.email} | nom: ${u.name} | rôle: ${u.role} | email vérifié: ${u.email_verified}`)
    const acc = await q('select provider_id from account where user_id=$1', [u.id])
    console.log(`     comptes d'auth: ${acc.map(a => a.provider_id).join(', ') || 'AUCUN'}`)
    const sess = await q('select count(*)::int as n from session where user_id=$1', [u.id])
    console.log(`     sessions actives: ${sess[0].n}`)
  }

  const salons = await q('select id, name, slug, city, status, timezone, currency, country from salons')
  console.log(`▶ Salons : ${salons.length}`)
  for (const s of salons) {
    console.log(`   - ${s.name} | slug: ${s.slug} | ville: ${s.city ?? '—'} | statut: ${s.status} | tz: ${s.timezone} | devise: ${s.currency} | pays: ${s.country}`)
    const m = await q('select role, active from salon_memberships where salon_id=$1', [s.id])
    console.log(`     membres: ${m.map(x => `${x.role}(actif=${x.active})`).join(', ') || 'AUCUN'}`)
    const st = await q('select settings from salon_settings where salon_id=$1', [s.id])
    if (st[0]) console.log(`     réglages: ${JSON.stringify(st[0].settings)}`)
  }

  const orphan = await q(
    `select count(*)::int as n from "user" u
     left join salon_memberships m on m.user_id=u.id
     where u.role='owner' and m.id is null`)
  console.log(`▶ Propriétaires sans salon (anomalie) : ${orphan[0].n}`)

  console.log('\n✅ Vérification terminée.')
} catch (e) {
  console.error('❌ Échec de vérification :', e.message ?? e)
  process.exitCode = 1
} finally {
  try { await pool.end() } catch {}
}
