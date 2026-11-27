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
            errors: [
              { path: 'role', message: 'There is already an Owner. Only one account can have it.' },
            ],
          })
        }
        return data
      },
    ],
    // Their saved articles and followed games go with them (GDPR: deleting an account deletes its
    // data). Before, not after: a saved article can't point to no reader.
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'bookmarks',
          where: { reader: { equals: id } },
          overrideAccess: true,
          req,
        })
        for (const collection of [
          'game-follows',
          'esport-follows',
          'reader-notifications',
          'push-subscriptions',
        ]) {
          await req.payload.delete({
            collection: collection as never,
            where: { reader: { equals: id } },
            overrideAccess: true,
            req,
          })
        }
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
        description:
          'Can no longer comment, vote, report, save or follow. Their comments stay unless you delete them.',
      },
    },
    {
      name: 'emailVerified',
      label: 'Email verified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Only verified accounts can write.',
      },
    },
    {
      name: 'clerkCreatedAt',
      label: 'Account created',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'lastSeenAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
    {
      // What their followed teams, tournaments and matches notify them of
      // (/account → Preferences, 2026-11-25). All on by default.
      name: 'notify',
      type: 'group',
      admin: { description: 'Set by the reader on /account. Esport notifications.' },
      fields: [
        { name: 'matchStart', label: 'Match starts', type: 'checkbox', defaultValue: true },
        { name: 'results', label: 'Results', type: 'checkbox', defaultValue: true },
        { name: 'news', label: 'News and transfers', type: 'checkbox', defaultValue: true },
        {
          // A copy of their anti-spoil default (Clerk unsafeMetadata.hideScores),
          // so a push notification of a result leaves the score out.
          name: 'hideScores',
          label: 'Hide scores in push notifications',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          // What their anti-spoil hides (Clerk unsafeMetadata.spoilerPrefs,
          // 2026-11-27): scores, winners, result articles, which games, all
          // teams or only theirs. Push follows it (lib/esport-follows.ts).
          name: 'spoilerPrefs',
          label: 'Anti-spoil settings',
          type: 'json',
          admin: { readOnly: true },
        },
      ],
    },
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

/** Followed games ("Follow" on a game page, listed on /account with their news). */
export const GameFollows: CollectionConfig = {
  slug: 'game-follows',
  labels: { singular: 'Followed game', plural: 'Followed games' },
  admin: {
    group: 'Readers',
    defaultColumns: ['reader', 'game', 'createdAt'],
    description: 'Games readers follow. Written by the site only.',
  },
  access: { create: () => false, read: admins, update: () => false, delete: admins },
  indexes: [{ fields: ['reader', 'game'], unique: true }],
  fields: [
    { name: 'reader', type: 'relationship', relationTo: 'readers', required: true, index: true },
    { name: 'game', type: 'relationship', relationTo: 'games', required: true, index: true },
  ],
}

/**
 * Followed esport teams, events and matches (2026-11-25): a team or a match by
 * its PandaScore id, an event by its PandaScore season (`serieId`: all its
 * stages). `label` / `logo` / `slug` are a snapshot for the reader's list.
 */
export const EsportFollows: CollectionConfig = {
  slug: 'esport-follows',
  labels: { singular: 'Followed esport item', plural: 'Followed esport items' },
  admin: {
    group: 'Readers',
    defaultColumns: ['reader', 'kind', 'label', 'game', 'createdAt'],
    description: 'Teams, tournaments and matches readers follow. Written by the site only.',
  },
  access: { create: () => false, read: admins, update: () => false, delete: admins },
  indexes: [{ fields: ['reader', 'kind', 'pandaId'], unique: true }],
  fields: [
    { name: 'reader', type: 'relationship', relationTo: 'readers', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Team', value: 'team' },
        { label: 'Event (all its stages)', value: 'event' },
        { label: 'Match', value: 'match' },
      ],
    },
    { name: 'pandaId', type: 'number', required: true, index: true },
    { name: 'game', type: 'text' },
    { name: 'label', type: 'text', required: true },
    { name: 'acronym', type: 'text' },
    { name: 'logo', type: 'text' },
    { name: 'slug', type: 'text', admin: { description: 'Event: a stage page to open.' } },
    { name: 'at', type: 'date', admin: { description: 'Match: when it starts.' } },
  ],
}

/**
 * What a reader is notified of (the bell, 2026-11-25): a followed match
 * starting or ending, a news about a followed team. `data` holds the facts
 * (teams, score, event, article); the site words it in the page's language
 * and hides the score while scores are hidden. Kept 30 days.
 */
export const ReaderNotifications: CollectionConfig = {
  slug: 'reader-notifications',
  labels: { singular: 'Reader notification', plural: 'Reader notifications' },
  admin: {
    group: 'Readers',
    defaultColumns: ['reader', 'kind', 'url', 'readAt', 'createdAt'],
    description:
      'Notifications of followed teams, tournaments and matches. Written by the CMS only.',
  },
  access: { create: () => false, read: admins, update: () => false, delete: admins },
  indexes: [{ fields: ['reader', 'dedupeKey'], unique: true }],
  fields: [
    { name: 'reader', type: 'relationship', relationTo: 'readers', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Match starts', value: 'match_start' },
        { label: 'Match result', value: 'match_end' },
        { label: 'News', value: 'article' },
      ],
    },
    { name: 'data', type: 'json', required: true },
    { name: 'url', type: 'text', required: true },
    { name: 'dedupeKey', type: 'text', required: true },
    { name: 'readAt', type: 'date', index: true },
  ],
}

/**
 * Web push (2026-11-25): one row per browser a reader turned notifications on
 * in (/account → Preferences). The endpoint is the browser maker's push
 * service (Google, Mozilla, Apple); the keys encrypt the message for that
 * browser only. A subscription the push service says is gone (404 / 410) is
 * deleted at the next send (src/lib/web-push.ts).
 */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  labels: { singular: 'Push subscription', plural: 'Push subscriptions' },
  admin: {
    group: 'Readers',
    defaultColumns: ['reader', 'locale', 'userAgent', 'createdAt'],
    description: 'Browsers that get push notifications. Written by the site only.',
  },
  access: { create: () => false, read: admins, update: () => false, delete: admins },
  fields: [
    { name: 'reader', type: 'relationship', relationTo: 'readers', required: true, index: true },
    { name: 'endpoint', type: 'text', required: true, unique: true, index: true },
    { name: 'p256dh', type: 'text', required: true },
    { name: 'auth', type: 'text', required: true },
    {
      name: 'locale',
      type: 'select',
      defaultValue: 'en',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Français', value: 'fr' },
      ],
    },
    { name: 'userAgent', type: 'text' },
  ],
}
