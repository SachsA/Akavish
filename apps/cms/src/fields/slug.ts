import type { Field } from 'payload'

/** Convertit une chaîne en slug : minuscules, sans accents, tirets. */
export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // tout caractère non alphanumérique -> tiret
    .replace(/^-+|-+$/g, '') // retire les tirets en début/fin

/**
 * Champ slug réutilisable.
 * - Se génère automatiquement depuis `sourceField` (par défaut "title") si laissé vide.
 * - Reste modifiable manuellement dans l'admin.
 * - Garantit l'unicité en ajoutant un suffixe (-2, -3, ...) en cas de collision.
 */
export const slugField = (sourceField = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
    description: 'Identifiant URL. Généré automatiquement depuis le titre si laissé vide.',
  },
  hooks: {
    beforeValidate: [
      async ({ value, data, req, collection, originalDoc }) => {
        // Détermine le slug de base : valeur saisie, sinon généré depuis la source.
        let base: string
        if (typeof value === 'string' && value.length > 0) {
          base = slugify(value)
        } else if (typeof data?.[sourceField] === 'string' && data[sourceField].length > 0) {
          base = slugify(data[sourceField])
        } else {
          return value
        }

        if (!base) return value

        const collectionSlug = collection?.slug
        // Sans contexte de collection (cas rare), on renvoie le slug de base.
        if (!collectionSlug || !req?.payload) return base

        // Cherche un suffixe libre : base, base-2, base-3, ...
        let candidate = base
        let suffix = 2
        // L'id du document courant, pour ne pas entrer en collision avec lui-même.
        const currentId = originalDoc?.id ?? data?.id

        while (true) {
          const existing = await req.payload.find({
            collection: collectionSlug,
            where: { slug: { equals: candidate } },
            limit: 1,
            depth: 0,
            pagination: false,
            req,
          })

          const clash = existing.docs.find((doc) => doc.id !== currentId)
          if (!clash) return candidate

          candidate = `${base}-${suffix}`
          suffix += 1
        }
      },
    ],
  },
})
