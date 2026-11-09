import 'dotenv/config'
import { env } from 'node:process'
import { Pool } from '@neondatabase/serverless'
if(!env.NEON_DATABASE_URL)throw new Error('NEON_DATABASE_URL est requis pour tester la connexion.')
const pool=new Pool({connectionString:env.NEON_DATABASE_URL})
try{const result=await pool.query('SELECT 1 AS reachable');if(result.rows[0]?.reachable!==1)throw new Error('La base Neon n’a pas répondu au test SELECT 1.');console.log('Connexion Neon confirmée avec une requête read-only SELECT 1. Aucun schéma ni enregistrement n’a été modifié.')}finally{await pool.end()}
