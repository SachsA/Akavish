import type { CollectionConfig } from 'payload'

/**
 * Newsletter sign-ups (double opt-in). Written only by the newsletter endpoints
 * (`src/lib/newsletter.ts`, mounted in payload.config.ts) on behalf of readers;
 * editors can look but not add anyone, since every address here must have
 * given consent itself.
 *
 * Lifecycle: `pending` on sign-up (a confirmation email goes out) → `confirmed`
 * when the reader clicks the link. Unsubscribing deletes the row; unconfirmed
 * sign-ups are deleted after 30 days. That's what the privacy policy promises.
 */
export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'source', 'confirmedAt', 'createdAt'],
    description:
      'Newsletter sign-ups. Readers add themselves (double opt-in) and remove themselves (unsubscribe link). Only confirmed addresses may be emailed.',
  },
  access: {
    // Default for read/update/delete: any logged-in editor. Nobody creates
    // through the API: the endpoints use the local API.
    create: () => false,
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      enumName: 'enum_subscribers_status',
      options: [
        { label: 'Pending (not confirmed yet)', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
      ],
      admin: { readOnly: true },
    },
    {
      // SHA-256 of the token sent by email (confirm and unsubscribe links).
      // Hidden from the API and the admin; the raw token is never stored.
      name: 'tokenHash',
      type: 'text',
      required: true,
      index: true,
      hidden: true,
    },
    {
      name: 'source',
      type: 'text',
      admin: { readOnly: true, description: 'Where the reader signed up (footer, article…).' },
    },
    {
      name: 'consentAt',
      type: 'date',
      required: true,
      admin: { readOnly: true, description: 'When the reader ticked the consent box.' },
    },
    { name: 'confirmationSentAt', type: 'date', admin: { readOnly: true } },
    { name: 'confirmedAt', type: 'date', admin: { readOnly: true } },
  ],
}
