import { ValidationError, type CollectionConfig } from 'payload'
import { admins, adminsField } from '../access/roles'
import { removeReaderCommunityData } from '../lib/comments'

export const READER_ROLES = ['owner', 'admin', 'moderator', 'author', 'reader'] as const
export type ReaderRole = (typeof READER_ROLES)[number]

/**
 * Reader accounts: one row per Clerk account (sign-up on akavish.gg), so the
 * site can attach things to a reader (saved articles today, comments later).
 * Clerk stays the source of truth for the login itself; this mirrors the
 * profile and adds what Clerk doesn't know: the role.
 *
 * Rows are written only by src/lib/readers.ts: on the reader's first visit to
 * a personal page (via the web) and by Clerk's webhook (name or avatar
 * changed, account deleted: the row and the saved articles go with it).
 *
 * The role is the badge next to the reader's name and what they may do on the
 * site. Owner is the site's creator: one account only. A reader whose email
 * matches a CMS user is linked to it and its author profile, and becomes
 * Author automatically.
 */
export const Readers: CollectionConfig = {
  slug: 'readers',
  labels: { singular: 'Reader', plural: 'Readers' },
  admin: {
    group: 'Readers',
    useAsTitle: 'username',
    defaultColumns: ['username', 'displayName', 'email', 'role', 'banned', 'createdAt'],
    description:
      'People with an account on the site (Clerk). Set the role here: it is the badge next to their name. Only one Owner.',
  },
  // Personal data: admins only. Nobody creates readers through the API.
  access: { create: () => false, read: admins, update: admins, delete: admins },
  hooks: {
    beforeChange: [
      // Only one owner, ever.
      async ({ data, originalDoc, req }) => {
        if (data.role !== 'owner' || originalDoc?.role === 'owner') return data
        const { totalDocs } = await req.payload.count({
          collection: 'readers',
          where: {
            role: { equals: 'owner' },
            ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
          },
          overrideAccess: true,
          req,
        })
        if (totalDocs > 0) {
          throw new ValidationError({
            collection: 'readers',
            errors: [{ path: 'role', message: 'There is already an Owner. Only one account can have it.' }],
          })
        }
        return data
      },
    ],
    // Their saved articles go with them (GDPR: deleting an account deletes its
    // data). Before, not after: a saved article can't point to no reader.
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'bookmarks',
          where: { reader: { equals: id } },
          overrideAccess: true,
          req,
        })
        // Comments, votes and reports (src/lib/comments.ts): a comment with
        // replies stays as "Comment deleted" so the thread still reads.
        await removeReaderCommunityData(req.payload, id, req)
      },
    ],
  },
  fields: [
    {
      name: 'clerkId',
      label: 'Clerk user id',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'username',
      label: 'Public name',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Shown on their comments: the Clerk username, else the first name.',
      },
    },
    {
      name: 'displayName',
      label: 'Full name',
      type: 'text',
      admin: { readOnly: true, description: 'Private (never shown on the site).' },
    },
    { name: 'email', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'imageUrl', label: 'Avatar URL', type: 'text', admin: { readOnly: true } },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'reader',
      enumName: 'enum_readers_role',
      options: [
        { label: 'Owner (the site’s creator, one account only)', value: 'owner' },
        { label: 'Admin', value: 'admin' },
        { label: 'Moderator', value: 'moderator' },
        { label: 'Author', value: 'author' },
        { label: 'Reader', value: 'reader' },
      ],
      access: { update: adminsField },
      admin: { position: 'sidebar', description: 'The badge next to their name on the site.' },
    },
    {
      name: 'cmsUser',
      label: 'CMS account',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Linked automatically when the emails match.',
      },
    },
    {
      name: 'author',
      label: 'Author profile',
      type: 'relationship',
      relationTo: 'authors',
      admin: {
        position: 'sidebar',
        description: 'Their byline, for the Author badge. Filled from the CMS account when linked.',
      },
    },
    {
      name: 'banned',
      type: 'checkbox',
      defaultValue: false,
      access: { update: adminsField },
      admin: {
        position: 'sidebar',
        description: 'Can no longer comment, vote, report or save. Their comments stay unless you delete them.',
      },
    },
    {
      name: 'emailVerified',
      label: 'Email verified',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', readOnly: true, description: 'Only verified accounts can write.' },
    },
    {
      name: 'clerkCreatedAt',
      label: 'Account created',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'lastSeenAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
  ],
}

/** Saved articles ("Save" on an article page, listed on /account). */
export const Bookmarks: CollectionConfig = {
  slug: 'bookmarks',
  labels: { singular: 'Saved article', plural: 'Saved articles' },
  admin: {
    group: 'Readers',
    defaultColumns: ['reader', 'article', 'createdAt'],
    description: 'Articles readers saved. Written by the site only.',
  },
  access: { create: () => false, read: admins, update: () => false, delete: admins },
  indexes: [{ fields: ['reader', 'article'], unique: true }],
  fields: [
    { name: 'reader', type: 'relationship', relationTo: 'readers', required: true, index: true },
    { name: 'article', type: 'relationship', relationTo: 'articles', required: true, index: true },
  ],
}
