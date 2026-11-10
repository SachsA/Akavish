// ─── Shared facts for the legal pages ────────────────────────────────────────
// The English and French pages render the SAME data from here. The prose is
// written twice (it has to be), but anything factual — who processes what, when
// the pages were last revised — exists once, so the two versions cannot drift.
//
// ⚠️ Add a third-party service to the site → add it here, in the same commit.
// An out-of-date processor list is the part of a privacy policy that actually
// gets you in trouble.

export const LEGAL_LAST_UPDATED = {
  en: 'November 2026',
  fr: 'novembre 2026',
} as const

/** Who publishes the site (LCEN art. 6 III — "directeur de la publication"). */
export const PUBLISHER = {
  name: 'Alexandre Sachs',
  contactEmail: 'hello@akavish.gg',
  privacyEmail: 'privacy@akavish.gg',
  // Non-professional publishers may withhold their postal address from the
  // public provided the host holds their identity — hence host details below
  // rather than a home address.
  host: {
    name: 'Vercel Inc.',
    address: '440 N Barranca Ave #4133, Covina, CA 91723, USA',
    url: 'https://vercel.com',
  },
  cmsHost: {
    name: 'Railway Corp.',
    url: 'https://railway.app',
  },
} as const

export type Processor = {
  /** Vendor name as it should appear to a reader. */
  name: string
  url: string
  /** Where the processing happens, in plain terms. */
  region: 'US' | 'EU/US'
  /** What we hand over — one clause per language. */
  data: { en: string; fr: string }
  /** Why. */
  purpose: { en: string; fr: string }
}

/**
 * Every third party that can see visitor data, verified against the code:
 * `apps/web/src/app/layout.tsx` (Clerk, Analytics), `lib/sentry-shared.ts`,
 * `apps/cms/src/payload.config.ts` (R2, Resend), `apps/cms/src/lib/newsletter.ts`
 * (newsletter sign-ups, stored in Neon, emailed through Resend), and the
 * deployment setup.
 */
export const PROCESSORS: Processor[] = [
  {
    name: 'Vercel',
    url: 'https://vercel.com/legal/privacy-policy',
    region: 'US',
    data: {
      en: 'IP address and request metadata in server logs; aggregated, cookieless page-view counts.',
      fr: "Adresse IP et métadonnées de requête dans les journaux serveur ; comptage de pages agrégé, sans cookie.",
    },
    purpose: {
      en: 'Hosts and serves the website, and provides its audience statistics.',
      fr: "Héberge et sert le site, et fournit ses statistiques d'audience.",
    },
  },
  {
    name: 'Clerk',
    url: 'https://clerk.com/legal/privacy',
    region: 'US',
    data: {
      en: 'Email address, and any name or avatar you provide or that Google, Discord, Twitch or X shares if you sign in with them. Only if you create an account.',
      fr: "Adresse e-mail, ainsi que le nom et l'avatar que vous fournissez ou que Google, Discord, Twitch ou X transmet si vous vous connectez avec. Uniquement si vous créez un compte.",
    },
    purpose: {
      en: 'Handles reader sign-up, sign-in and sessions.',
      fr: 'Gère la création de compte, la connexion et les sessions des lecteurs.',
    },
  },
  {
    name: 'Sentry',
    url: 'https://sentry.io/privacy/',
    region: 'US',
    data: {
      en: 'Error messages and stack traces, the URL path, browser and operating-system version. Configured to send no IP address, cookies, headers, request bodies or query parameters.',
      fr: "Messages d'erreur et traces d'appel, chemin d'URL, versions du navigateur et du système. Configuré pour n'envoyer ni adresse IP, ni cookies, ni en-têtes, ni corps de requête, ni paramètres d'URL.",
    },
    purpose: {
      en: 'Tells us when a page breaks, so we can fix it.',
      fr: 'Nous signale les pages en erreur afin que nous puissions les corriger.',
    },
  },
  {
    name: 'Cloudflare',
    url: 'https://www.cloudflare.com/privacypolicy/',
    region: 'US',
    data: {
      en: 'DNS queries for the domain; the content of any email you send to an @akavish.gg address; images served from storage.',
      fr: "Requêtes DNS du domaine ; contenu des e-mails que vous envoyez à une adresse @akavish.gg ; images servies depuis le stockage.",
    },
    purpose: {
      en: 'Resolves the domain, forwards our email, and stores article images.',
      fr: 'Résout le domaine, relaie nos e-mails et stocke les images des articles.',
    },
  },
  {
    name: 'Neon',
    url: 'https://neon.tech/privacy-policy',
    region: 'EU/US',
    data: {
      en: 'Article content, editor accounts, and the email address of newsletter subscribers.',
      fr: "Contenu des articles, comptes des rédacteurs et adresse e-mail des abonnés à la newsletter.",
    },
    purpose: {
      en: 'Hosts the database behind the site.',
      fr: 'Héberge la base de données du site.',
    },
  },
  {
    name: 'Resend',
    url: 'https://resend.com/legal/privacy-policy',
    region: 'US',
    data: {
      en: 'Email addresses of editors (password resets on the admin panel) and of newsletter subscribers (confirmation email, then the newsletter itself).',
      fr: "Adresses e-mail des rédacteurs (réinitialisation de mot de passe de l'administration) et des abonnés à la newsletter (e-mail de confirmation, puis la newsletter elle-même).",
    },
    purpose: {
      en: 'Sends the back-office emails and the newsletter.',
      fr: "Envoie les e-mails du back-office et la newsletter.",
    },
  },
]
