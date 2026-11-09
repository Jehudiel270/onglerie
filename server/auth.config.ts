import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { defineServerAuth } from '@nuxtjs/better-auth/config'
import { accounts, sessions, users, verifications } from './db/schema'
import { getDatabase, hasNeonDatabase } from './db/client'

export default defineServerAuth((context) => {
  const requestOrigin = context.requestOrigin ?? ''
  const publicHttps = requestOrigin.startsWith('https://')
  const database = hasNeonDatabase()
    ? drizzleAdapter(getDatabase(), {
        provider: 'pg',
        schema: {
          user: users,
          session: sessions,
          account: accounts,
          verification: verifications,
        },
      })
    : undefined

  return {
    ...(database ? { database } : {}),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'customer', input: false },
      },
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: publicHttps ? 'none' : 'lax',
        secure: publicHttps,
        httpOnly: true,
        path: '/',
      },
    },
    trustedOrigins: requestOrigin ? [requestOrigin] : [],
  }
})
