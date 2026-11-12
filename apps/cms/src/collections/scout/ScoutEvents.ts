import type { CollectionConfig } from 'payload'

/**
 * Event mode (step 5): one live article during a showcase, fed by the scout's
 * feeds and by the editor's `/live add` on Discord, updated every 5 minutes,
 * then a recap article when the editor runs `/live stop`. Created and driven
 * from Discord (src/scout/live.ts); read-only here except for fixes.
 */
export const ScoutEvents: CollectionConfig = {
  slug: 'scout-events',
  labels: { singular: 'Scout event', plural: 'Scout events' },
  admin: {
    group: 'Scout',
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'startedAt', 'rev'],
    description: 'Live events (Game Awards, State of Play…) started with /live on Discord.',
  },
  access: { create: () => false },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'live',
      index: true,
      enumName: 'enum_scout_events_status',
      options: [
        { label: 'Live', value: 'live' },
        { label: 'Ending (recap on the next run)', value: 'ending' },
        { label: 'Ended', value: 'ended' },
      ],
    },
    { name: 'startedAt', type: 'date', required: true },
    { name: 'endedAt', type: 'date' },
    { name: 'article', type: 'relationship', relationTo: 'articles' },
    { name: 'recapArticle', type: 'relationship', relationTo: 'articles' },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'The editor clicked "Publier le live": updates now go live by themselves.',
      },
    },
    { name: 'intro', type: 'textarea' },
    { name: 'entries', type: 'json', admin: { description: 'The announcements, oldest first.' } },
    {
      name: 'notes',
      type: 'json',
      admin: { description: "The editor's /live add, pending or done." },
    },
    {
      name: 'previous',
      type: 'json',
      admin: { description: 'Intro and entries before the last update (undo).' },
    },
    { name: 'rev', type: 'number', defaultValue: 0 },
    { name: 'itemsSince', type: 'date', admin: { description: 'Scout items read up to here.' } },
    { name: 'lastUpdateAt', type: 'date' },
    { name: 'discordMessageId', type: 'text' },
  ],
}
