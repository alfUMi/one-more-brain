import { newId } from '@omb/shared'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { bearer, magicLink } from 'better-auth/plugins'

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined

export const googleEnabled = Boolean(google)

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  advanced: {
    // UUIDv7 ids, like every other table.
    database: { generateId: () => newId() },
  },
  socialProviders: google ? { google } : {},
  // The mobile app signs out and revokes devices with its bearer token from its own origin.
  trustedOrigins: APP_ORIGINS,
  plugins: [
    magicLink({
      expiresIn: 10 * 60,
      sendMagicLink: async ({ email, url }) => {
        await sendMail(
          email,
          'Your sign-in link for One More Brain',
          `Sign in to One More Brain:\n${url}\n\nThe link expires in 10 minutes. If you didn't ask for it, ignore this email.`,
          `<p>Sign in to <b>One More Brain</b>:</p><p><a href="${url}">Sign in</a></p><p style="color:#666">The link expires in 10 minutes. If you didn't ask for it, ignore this email.</p>`,
        )
      },
    }),
    // Lets the extension and mobile app authenticate with `Authorization: Bearer <token>`.
    bearer(),
  ],
})
