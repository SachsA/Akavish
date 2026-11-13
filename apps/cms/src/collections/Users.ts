import type { CollectionConfig } from 'payload'

import {
  FORGOT_PASSWORD_EXPIRATION_MS,
  forgotPasswordHTML,
  forgotPasswordSubject,
} from '../lib/emails/forgot-password'
import { admins, adminsField, isAdminUser, staff } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'author'],
  },
  // Who may do what with the accounts themselves. What each role may do with
  // the content is in src/access/roles.ts.
  access: {
    create: admins,
    read: staff,
    update: ({ req: { user } }) => {
      if (isAdminUser(user)) return true
      return user?.collection === 'users' ? { id: { equals: user.id } } : false
    },
    delete: admins,
  },
  hooks: {
    beforeChange: [
      // The very first account (the "create first user" screen, or `pnpm seed`
      // on an empty database) is always an admin, or nobody could ever manage
      // users. Everyone after that starts as a writer unless an admin says otherwise.
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
        if (totalDocs === 0) data.role = 'admin'
        return data
      },
    ],
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
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'writer',
      enumName: 'enum_users_role',
      saveToJWT: true,
      options: [
        { label: 'Admin (everything)', value: 'admin' },
        { label: 'Editor (writes and publishes any article)', value: 'editor' },
        { label: 'Writer (drafts under their own author profile)', value: 'writer' },
      ],
      access: { create: adminsField, update: adminsField },
      admin: {
        position: 'sidebar',
        description: 'Only an admin can change it. Details in src/access/roles.ts.',
      },
    },
    {
      // The public byline this account writes as. A writer's articles always
      // get it; a reader account (Clerk) with the same email is linked to it
      // and shows the Author badge in the comments.
      name: 'author',
      label: 'Author profile',
      type: 'relationship',
      relationTo: 'authors',
      access: { create: adminsField, update: adminsField },
      admin: { position: 'sidebar' },
    },
  ],
}
