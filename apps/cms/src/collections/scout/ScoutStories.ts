import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'

/**
 * A story (sujet): every item about the same news, grouped, with a score out of
 * 100 that decides what reaches Discord (design doc: "Collecte, regroupement et
 * score"). Step 1 only lists them in the 8 am / 8 pm digests; drafts and the
 * Discord buttons come with step 2, hence the statuses declared ahead.
 */
export const ScoutStories: CollectionConfig = {
  slug: 'scout-stories',
  labels: { singular: 'Scout story', plural: 'Scout stories' },
  admin: {
    group: 'Scout',
    useAsTitle: 'title',
    defaultColumns: ['title', 'score', 'sourceCount', 'category', 'status', 'updatedAt'],
    description: 'Stories the scout found, scored out of 100.',
  },
  access: { create: () => false, read: editors, update: editors, delete: editors },
  defaultSort: '-score',
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'score',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      max: 100,
      index: true,
      admin: { readOnly: true, description: 'Recomputed whenever a new item joins the story.' },
    },
    {
      name: 'significance',
      type: 'number',
      min: 0,
      max: 100,
      admin: {
        readOnly: true,
        description:
          'How big the news is on its own (the model’s estimate), one input of the score.',
      },
    },
    { name: 'sourceCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    {
      name: 'bestReliability',
      type: 'select',
      enumName: 'enum_scout_stories_best_reliability',
      options: [
        { label: 'Official', value: 'official' },
        { label: 'High', value: 'high' },
        { label: 'Variable', value: 'variable' },
      ],
      admin: { readOnly: true },
    },
    { name: 'game', type: 'text' },
    {
      name: 'category',
      type: 'select',
      enumName: 'enum_scout_stories_category',
      // Same values as the Articles `category` select, so a draft can take it.
      options: [
        { label: 'News', value: 'news' },
        { label: 'Leak', value: 'leak' },
        { label: 'Review', value: 'review' },
        { label: 'Preview', value: 'preview' },
        { label: 'Conference', value: 'conference' },
        { label: 'Esport', value: 'esport' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      enumName: 'enum_scout_stories_status',
      options: [
        { label: 'New (not in a digest yet)', value: 'new' },
        { label: 'Listed in a digest', value: 'listed' },
        { label: 'Drafted (step 2)', value: 'drafted' },
        { label: 'Published (step 2)', value: 'published' },
        { label: 'Rejected (step 2)', value: 'rejected' },
      ],
    },
    {
      name: 'firstSeenAt',
      type: 'date',
      required: true,
      admin: { readOnly: true, description: 'Publication date of its oldest item.' },
    },
    { name: 'lastItemAt', type: 'date', admin: { readOnly: true } },
    {
      type: 'collapsible',
      label: 'Draft (step 2)',
      fields: [
        {
          name: 'article',
          type: 'relationship',
          relationTo: 'articles',
          admin: { readOnly: true, description: 'The draft the scout wrote for this story.' },
        },
        { name: 'draftedAt', type: 'date', index: true, admin: { readOnly: true } },
        {
          name: 'version',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true, description: '1 for the first draft, +1 per revision.' },
        },
        {
          name: 'discordMessageId',
          type: 'text',
          admin: { readOnly: true, description: 'Discord message holding the current version.' },
        },
        {
          name: 'feedback',
          type: 'array',
          admin: { readOnly: true, description: 'What you asked to change, version by version.' },
          fields: [
            { name: 'text', type: 'textarea', required: true },
            { name: 'version', type: 'number' },
          ],
        },
        { name: 'rejectionReason', type: 'text', admin: { readOnly: true } },
        {
          // The current version's text as the scout wrote it, so a revision
          // shows the model what it wrote before the feedback.
          name: 'lastDraftText',
          type: 'textarea',
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'items',
      type: 'join',
      collection: 'scout-items',
      on: 'story',
      admin: { defaultColumns: ['title', 'source', 'publishedAt'] },
    },
  ],
}
