import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'

/**
 * Where the AI scout reads the news (design doc: "Sources"). Editable in the
 * admin: add, mute or re-rate a feed without touching code. Filled with the
 * default list (src/scout/default-sources.ts) the first time the scout runs.
 */
export const ScoutSources: CollectionConfig = {
  slug: 'scout-sources',
  labels: { singular: 'Scout source', plural: 'Scout sources' },
  admin: {
    group: 'Scout',
    useAsTitle: 'name',
    defaultColumns: ['name', 'reliability', 'cadence', 'active', 'lastStatus', 'lastFetchedAt'],
    description:
      'Feeds the scout reads. Official sources are read every 5 minutes, the rest every 15. Untick "active" to mute one.',
  },
  access: { read: editors, create: editors, update: editors, delete: editors },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'rss',
      enumName: 'enum_scout_sources_kind',
      // `x` arrives with step 3 (leakers on X), declared now so the column
      // doesn't need another migration then.
      options: [
        { label: 'RSS / Atom feed', value: 'rss' },
        { label: 'X account', value: 'x' },
      ],
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Feed URL (RSS or Atom). For X: the account handle.' },
    },
    {
      name: 'reliability',
      type: 'select',
      required: true,
      defaultValue: 'high',
      enumName: 'enum_scout_sources_reliability',
      options: [
        { label: 'Official (publisher, platform)', value: 'official' },
        { label: 'High (established outlet)', value: 'high' },
        { label: 'Variable (leakers, rumours)', value: 'variable' },
      ],
    },
    {
      name: 'cadence',
      type: 'select',
      required: true,
      defaultValue: 'normal',
      enumName: 'enum_scout_sources_cadence',
      options: [
        { label: 'Fast (every 5 min)', value: 'fast' },
        { label: 'Normal (every 15 min)', value: 'normal' },
      ],
    },
    {
      name: 'language',
      type: 'select',
      required: true,
      defaultValue: 'en',
      enumName: 'enum_scout_sources_language',
      options: [
        { label: 'English', value: 'en' },
        { label: 'French', value: 'fr' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'general',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'General outlet (Fortune, Le Monde…): only items that mention games are kept, the rest is skipped before the AI reads it.',
      },
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
    {
      type: 'collapsible',
      label: 'Fetch status',
      admin: { initCollapsed: true },
      fields: [
        { name: 'lastFetchedAt', type: 'date', admin: { readOnly: true } },
        {
          name: 'lastStatus',
          type: 'text',
          admin: { readOnly: true, description: 'ok, not modified, or the last error.' },
        },
        {
          name: 'consecutiveFailures',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
        // Conditional GET: the feed answers 304 when nothing changed.
        { name: 'etag', type: 'text', admin: { readOnly: true } },
        { name: 'lastModified', type: 'text', admin: { readOnly: true } },
      ],
    },
  ],
}
