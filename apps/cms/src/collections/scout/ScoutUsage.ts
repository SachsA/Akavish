import type { CollectionConfig } from 'payload'
import { editors } from '../../access/roles'

/**
 * One row per paid call (AI model, later the X API), with its estimated cost.
 * The budget caps read this (src/scout/budget.ts). Kept 13 months.
 */
export const ScoutUsage: CollectionConfig = {
  slug: 'scout-usage',
  labels: { singular: 'Scout usage', plural: 'Scout usage' },
  admin: {
    group: 'Scout',
    defaultColumns: ['createdAt', 'purpose', 'model', 'costUsd'],
    description: 'Every paid call the scout made, with its estimated cost in USD.',
  },
  access: { create: () => false, update: () => false, read: editors, delete: editors },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      enumName: 'enum_scout_usage_kind',
      options: [
        { label: 'AI model', value: 'llm' },
        { label: 'X API', value: 'x' },
      ],
    },
    { name: 'purpose', type: 'text', required: true },
    { name: 'model', type: 'text' },
    { name: 'inputTokens', type: 'number' },
    { name: 'outputTokens', type: 'number' },
    { name: 'costUsd', type: 'number', required: true },
  ],
}
