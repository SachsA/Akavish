import type { GlobalConfig } from 'payload'
import { editors } from '../../access/roles'

/**
 * The scout's switches and memory: pause, threshold, and when each digest and
 * budget alert last went out (so a restart never sends one twice).
 */
export const ScoutSettings: GlobalConfig = {
  slug: 'scout-settings',
  label: 'Scout settings',
  admin: { group: 'Scout' },
  access: { read: editors, update: editors },
  fields: [
    {
      name: 'paused',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Stops collecting and scoring. Also set automatically when the monthly budget is spent; untick to resume.',
      },
    },
    {
      name: 'draftsEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Step 2: write a draft automatically for every story at or above the threshold and send it to Discord with Publish / Edit / Reject. Off: the digests still list everything, and the "Write" menu in them still works.',
      },
    },
    {
      name: 'maxDraftsPerDay',
      type: 'number',
      defaultValue: 20,
      min: 0,
      admin: {
        description: 'Automatic drafts per day, at most (manual ones from Discord not counted).',
      },
    },
    {
      name: 'defaultAuthor',
      type: 'relationship',
      relationTo: 'authors',
      admin: {
        description:
          'Author of the scout’s drafts. Empty: the first author in the CMS (created as "Akavish Newsroom" if there is none).',
      },
    },
    {
      name: 'threshold',
      type: 'number',
      defaultValue: 60,
      min: 0,
      max: 100,
      admin: {
        description:
          'Score from which a story gets a draft (step 2). In the digests, stories at or above it are marked.',
      },
    },
    {
      type: 'collapsible',
      label: 'Internal state',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'lastMorningDigest',
          type: 'text',
          admin: {
            readOnly: true,
            description: 'Paris date (YYYY-MM-DD) of the last 8 am digest.',
          },
        },
        {
          name: 'lastEveningDigest',
          type: 'text',
          admin: { readOnly: true, description: 'Paris date of the last 8 pm digest.' },
        },
        {
          name: 'lastBudgetAlert',
          type: 'text',
          admin: {
            readOnly: true,
            description: 'Budget alerts already sent (e.g. 2026-11:80), so each goes out once.',
          },
        },
      ],
    },
  ],
}
