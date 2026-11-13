import type { CollectionConfig, GlobalConfig } from 'payload'
import { admins, editors } from '../access/roles'
import { purgeCommentDependents } from '../lib/comments'

// Reader comments under articles. Written only by src/lib/comments.ts (the
// website, through READER_API_SECRET); moderated on the site by Owner / Admin /
// Mod readers, and here in /admin by editors and admins.
//
// Threads are one level deep: a reply belongs to the top-level comment it sits
// under (`parent`) and remembers which comment it answers (`replyTo`, and the
// name it showed then, `replyToName`), so "@name" stays right in a long thread.

export const COMMENT_STATUSES = ['visible', 'hidden', 'deleted'] as const
export type CommentStatus = (typeof COMMENT_STATUSES)[number]

export const REPORT_REASONS = ['spam', 'harassment', 'illegal', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const Comments: CollectionConfig = {
  slug: 'comments',
  labels: { singular: 'Comment', plural: 'Comments' },
  admin: {
    group: 'Community',
    useAsTitle: 'body',
    defaultColumns: ['body', 'reader', 'article', 'status', 'likes', 'dislikes', 'reportCount', 'createdAt'],
    description:
      'Reader comments. "Hidden" shows a placeholder on the site (restorable); deleting removes it and its replies.',
  },
  defaultSort: '-createdAt',
  access: { create: () => false, read: editors, update: editors, delete: editors },
  hooks: {
    // Its votes, reports and replies go first (they can't point to nothing).
    beforeDelete: [
      async ({ id, req, context }) => {
        if (context?.skipCommentCascade) return
        await purgeCommentDependents(req.payload, id, req)
      },
    ],
  },
  fields: [
    { name: 'body', type: 'textarea', required: false, maxLength: 2000, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'visible',
      enumName: 'enum_comments_status',
      options: [
        { label: 'Visible', value: 'visible' },
        { label: 'Hidden (by a moderator or by reports)', value: 'hidden' },
        { label: 'Deleted (kept as a placeholder for its replies)', value: 'deleted' },
      ],
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'autoHidden',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Hidden automatically after enough reports. Set Visible to restore it.',
      },
    },
    { name: 'article', type: 'relationship', relationTo: 'articles', required: true, index: true, admin: { readOnly: true } },
    // Empty once the author deleted their account or their comment.
    { name: 'reader', type: 'relationship', relationTo: 'readers', index: true, admin: { readOnly: true } },
    {
      name: 'parent',
      label: 'Thread (top-level comment)',
      type: 'relationship',
      relationTo: 'comments',
      index: true,
      admin: { readOnly: true },
    },
    { name: 'replyTo', label: 'Replying to', type: 'relationship', relationTo: 'comments', admin: { readOnly: true } },
    { name: 'replyToName', type: 'text', admin: { readOnly: true } },
    { name: 'likes', type: 'number', defaultValue: 0, index: true, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'dislikes', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'reportCount', label: 'Reports', type: 'number', defaultValue: 0, admin: { readOnly: true, position: 'sidebar' } },
  ],
}

/** Like (+1) or dislike (-1), one per reader and comment. The counts live on the comment. */
export const CommentVotes: CollectionConfig = {
  slug: 'comment-votes',
  labels: { singular: 'Comment vote', plural: 'Comment votes' },
  admin: { group: 'Community', hidden: true },
  access: { create: () => false, read: admins, update: () => false, delete: admins },
  indexes: [{ fields: ['reader', 'comment'], unique: true }],
  fields: [
    { name: 'reader', type: 'relationship', relationTo: 'readers', required: true, index: true },
    { name: 'comment', type: 'relationship', relationTo: 'comments', required: true, index: true },
    { name: 'value', type: 'number', required: true, min: -1, max: 1 },
  ],
}

/** "Report" on a comment. One per reader and comment; also posted to the moderation Discord channel. */
export const CommentReports: CollectionConfig = {
  slug: 'comment-reports',
  labels: { singular: 'Report', plural: 'Reports' },
  admin: {
    group: 'Community',
    defaultColumns: ['reason', 'comment', 'status', 'createdAt'],
    description:
      'Reports from readers. Open the comment to hide or delete it, then mark the report Resolved. The law expects illegal content to be removed promptly once reported.',
  },
  defaultSort: '-createdAt',
  access: { create: () => false, read: editors, update: editors, delete: editors },
  indexes: [{ fields: ['reader', 'comment'], unique: true }],
  fields: [
    { name: 'comment', type: 'relationship', relationTo: 'comments', required: true, index: true, admin: { readOnly: true } },
    { name: 'reader', label: 'Reported by', type: 'relationship', relationTo: 'readers', required: true, index: true, admin: { readOnly: true } },
    {
      name: 'reason',
      type: 'select',
      required: true,
      enumName: 'enum_comment_reports_reason',
      options: [
        { label: 'Spam', value: 'spam' },
        { label: 'Harassment or hate', value: 'harassment' },
        { label: 'Illegal content', value: 'illegal' },
        { label: 'Other', value: 'other' },
      ],
      admin: { readOnly: true },
    },
    { name: 'note', type: 'textarea', maxLength: 500, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      enumName: 'enum_comment_reports_status',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Resolved', value: 'resolved' },
      ],
      index: true,
      admin: { position: 'sidebar' },
    },
  ],
}

/** Site-wide switches for the community features. */
export const CommunitySettings: GlobalConfig = {
  slug: 'community-settings',
  label: 'Community settings',
  admin: { group: 'Community' },
  access: { read: editors, update: admins },
  fields: [
    {
      name: 'commentsEnabled',
      label: 'Comments on',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Untick to switch comments off everywhere at once: they disappear from the site and nobody can post. Nothing is deleted.',
      },
    },
    {
      name: 'autoHideReports',
      label: 'Hide a comment after this many reports',
      type: 'number',
      defaultValue: 3,
      min: 1,
      max: 50,
      admin: { description: 'From different readers. It stays hidden until you restore it.' },
    },
  ],
}
