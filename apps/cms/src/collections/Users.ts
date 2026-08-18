import type { CollectionConfig } from 'payload'

import {
  FORGOT_PASSWORD_EXPIRATION_MS,
  forgotPasswordHTML,
  forgotPasswordSubject,
} from '../lib/emails/forgot-password'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  // Auth for CMS editors only — readers authenticate through Clerk on the web app.
  auth: {
    // Branded reset email instead of Payload's bare default. These are runtime
    // options, not fields: they add no columns, so changing them needs no
    // migration. The mail is only actually delivered if the CMS has an email
    // adapter configured (Resend — see payload.config.ts / DEPLOYMENT.md §4c);
    // otherwise Payload logs it to the console.
    forgotPassword: {
      expiration: FORGOT_PASSWORD_EXPIRATION_MS,
      generateEmailSubject: forgotPasswordSubject,
      generateEmailHTML: forgotPasswordHTML,
    },
  },
  fields: [
    // Email, password and the auth bookkeeping fields are added by `auth`.
  ],
}
