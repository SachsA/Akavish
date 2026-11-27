import type { CollectionConfig } from 'payload'
import { editors } from '../access/roles'
import { slugField } from '../fields/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-web'

/**
 * The industry's events, upcoming and past: showcases (State of Play, Nintendo
 * Direct, Xbox Showcase), awards (The Game Awards), expos (gamescom, Tokyo
 * Game Show) and developer conferences (GDC). The site's events calendar
 * (/conferences/calendar) lists them with the start time in the reader's
 * zone, the stream, and once it's over the Akavish recap (2026-11-27, an idea
 * from a friend of Alex).
 */
export const Events: CollectionConfig = {
  slug: 'events',
  labels: { singular: 'Event', plural: 'Events' },
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  access: { read: () => true, delete: editors },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'startAt', 'article'],
    description:
      'Le calendrier des événements du site (conférences, Directs, Game Awards, salons). L’heure est montrée dans le fuseau du lecteur.',
  },
  defaultSort: '-startAt',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Nom tel qu’on l’écrit : « The Game Awards 2026 », « Nintendo Direct ».',
      },
    },
    slugField('name'),
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'showcase',
          options: [
            { label: 'Conférence / showcase', value: 'showcase' },
            { label: 'Cérémonie (awards)', value: 'awards' },
            { label: 'Salon', value: 'expo' },
            { label: 'Conférence pro (GDC…)', value: 'conference' },
            { label: 'Autre', value: 'other' },
          ],
        },
        {
          name: 'startAt',
          type: 'date',
          required: true,
          index: true,
          admin: {
            date: { pickerAppearance: 'dayAndTime' },
            description:
              'Début (ton heure). Sans heure connue : la date seule et décocher « Heure connue ».',
          },
        },
        {
          name: 'timeKnown',
          type: 'checkbox',
          defaultValue: true,
          label: 'Heure connue',
          admin: { description: 'Décoché : le site montre la date seule.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'endAt',
          type: 'date',
          admin: {
            date: { pickerAppearance: 'dayOnly' },
            description: 'Dernier jour, pour un salon sur plusieurs jours. Vide = un seul jour.',
          },
        },
        {
          name: 'location',
          type: 'text',
          admin: { description: '« Los Angeles », « Cologne », « En ligne ».' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'streamUrl',
          type: 'text',
          admin: { description: 'Où le regarder en direct (YouTube, Twitch…).' },
        },
        { name: 'officialUrl', type: 'text', admin: { description: 'Le site officiel.' } },
      ],
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      admin: { description: 'Le récap Akavish, une fois l’événement passé.' },
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: { description: 'Une ligne sur ce qu’on peut en attendre (anglais). Facultatif.' },
    },
    {
      name: 'summaryFr',
      type: 'textarea',
      label: 'Summary (French)',
      admin: { description: 'La même ligne en français. Vide = l’anglais.' },
    },
  ],
}
