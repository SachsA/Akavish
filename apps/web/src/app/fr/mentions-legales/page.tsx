import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage } from '@/components/ContentPage'
import { LegalLanguageSwitch, legalAlternates } from '@/components/LegalLanguageSwitch'
import { LEGAL_LAST_UPDATED, PUBLISHER } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Informations sur l’éditeur et l’hébergeur d’Akavish.',
  alternates: legalAlternates('legal', 'fr'),
}

export default function MentionsLegalesPage() {
  return (
    <ContentPage
      title="Mentions légales"
      subtitle={`Dernière mise à jour : ${LEGAL_LAST_UPDATED.fr}`}
    >
      <LegalLanguageSwitch page="legal" current="fr" />

      <p>
        Akavish est édité depuis la France. Les informations ci-dessous sont
        publiées en application de l’article 6 de la loi n° 2004-575 du 21 juin
        2004 pour la confiance dans l’économie numérique (LCEN).
      </p>

      <h2>Éditeur</h2>
      <p>
        <strong>{PUBLISHER.name}</strong>, directeur de la publication.
        <br />
        Contact : <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>
      </p>
      <p>
        Akavish est une publication personnelle à caractère non commercial. En
        tant qu’éditeur non professionnel, l’adresse postale n’est pas publiée
        ici : elle est détenue par l’hébergeur mentionné ci-dessous et tenue à la
        disposition des autorités judiciaires, comme la loi le prévoit.
      </p>

      <h2>Hébergement</h2>
      <p>
        <strong>Site web</strong> — {PUBLISHER.host.name},{' '}
        {PUBLISHER.host.address} —{' '}
        <a href={PUBLISHER.host.url} target="_blank" rel="noopener noreferrer">
          {PUBLISHER.host.url}
        </a>
      </p>
      <p>
        <strong>Back-office éditorial</strong> — {PUBLISHER.cmsHost.name} —{' '}
        <a href={PUBLISHER.cmsHost.url} target="_blank" rel="noopener noreferrer">
          {PUBLISHER.cmsHost.url}
        </a>
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les articles et les médias originaux sont la propriété de l’éditeur. Les
        titres de jeux, logos et supports promotionnels appartiennent à leurs
        détenteurs respectifs et sont utilisés à des fins d’information et de
        commentaire. Demandes de retrait :{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement de vos données et les modalités d’exercice de vos droits
        sont détaillés dans la{' '}
        <Link href="/fr/confidentialite">politique de confidentialité</Link>. Demandes :{' '}
        <a href={`mailto:${PUBLISHER.privacyEmail}`}>{PUBLISHER.privacyEmail}</a>.
      </p>

      <h2>Signalement de contenu illicite</h2>
      <p>
        Si vous estimez qu’un contenu de ce site est illicite, écrivez à{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>{' '}
        en décrivant le contenu, son emplacement et le motif du signalement. Ces
        signalements sont examinés sans délai.
      </p>
    </ContentPage>
  )
}
