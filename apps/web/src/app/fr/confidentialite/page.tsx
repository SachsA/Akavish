import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage } from '@/components/ContentPage'
import { ProcessorTable } from '@/components/ProcessorTable'
import { LegalLanguageSwitch, legalAlternates } from '@/components/LegalLanguageSwitch'
import { LEGAL_LAST_UPDATED, PUBLISHER } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Les données collectées par Akavish, qui les traite, et vos droits.',
  alternates: legalAlternates('privacy', 'fr'),
}

export default function ConfidentialitePage() {
  return (
    <ContentPage
      title="Politique de confidentialité"
      subtitle={`Dernière mise à jour : ${LEGAL_LAST_UPDATED.fr}`}
    >
      <LegalLanguageSwitch page="privacy" current="fr" />

      <h2>En résumé</h2>
      <p>
        Lire Akavish ne demande ni compte ni pistage. Nous ne vendons ni ne
        partageons vos données à des fins publicitaires, nous ne constituons pas
        de profils de lecteurs et nous n’utilisons aucun cookie publicitaire. Si
        vous créez un compte, nous conservons votre adresse e-mail pour vous
        permettre de vous reconnecter — rien de plus.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        Akavish est édité par {PUBLISHER.name}, responsable du traitement au sens
        du RGPD. Contact :{' '}
        <a href={`mailto:${PUBLISHER.privacyEmail}`}>{PUBLISHER.privacyEmail}</a>.
        Les informations d’édition et d’hébergement figurent dans les{' '}
        <Link href="/fr/mentions-legales">mentions légales</Link>.
      </p>

      <h2>Données collectées</h2>
      <p>
        <strong>Lorsque vous lisez simplement le site.</strong> Notre hébergeur
        enregistre des journaux serveur standards, qui contiennent votre adresse
        IP. Nous mesurons l’audience avec Vercel Web Analytics, sans cookie :
        l’outil compte les pages vues et le pays approximatif, sans vous
        identifier ni vous suivre d’un site à l’autre. En cas d’erreur, un
        rapport est envoyé à Sentry — configuré pour exclure votre adresse IP,
        les cookies, les en-têtes et le contenu des formulaires.
      </p>
      <p>
        <strong>Si vous créez un compte.</strong> L’inscription et la connexion
        sont gérées par Clerk, qui conserve votre adresse e-mail ainsi que le nom
        et l’avatar que vous choisissez de fournir. À ce jour, un compte lecteur
        ne débloque rien d’autre que le fait d’être connecté.
      </p>
      <p>
        <strong>Si vous nous écrivez.</strong> Les messages adressés à une adresse
        @akavish.gg sont redirigés vers une boîte personnelle via Cloudflare Email
        Routing. Nous les conservons le temps nécessaire au traitement de votre
        demande.
      </p>
      <p>
        Nous ne collectons pas sciemment de données concernant les mineurs de
        moins de 15 ans, âge du consentement numérique en France.
      </p>

      <h2>Cookies</h2>
      <p>
        Akavish dépose <strong>uniquement des cookies strictement nécessaires</strong>,
        placés par Clerk pour maintenir votre session et protéger le formulaire de
        connexion. Aucun cookie publicitaire, de profilage ou de mesure
        d’audience — c’est la raison pour laquelle aucun bandeau de consentement
        ne vous est présenté. Vous pouvez bloquer les cookies dans votre
        navigateur : le site continuera de fonctionner, mais la connexion ne sera
        plus possible.
      </p>

      <h2>Destinataires des données</h2>
      <p>
        Nous limitons volontairement le nombre de tiers. Chacun agit sur nos
        instructions, pour la finalité indiquée :
      </p>
      <ProcessorTable lang="fr" />
      <p>
        Plusieurs de ces prestataires sont établis aux États-Unis : vos données
        peuvent donc être transférées hors de l’EEE. Ces transferts reposent sur
        les clauses contractuelles types de la Commission européenne et, le cas
        échéant, sur le cadre de protection des données UE–États-Unis.
      </p>

      <h2>Bases légales</h2>
      <p>
        Servir le site, le sécuriser et le maintenir en état de marche relève de
        notre intérêt légitime à faire fonctionner une publication. Votre compte
        existe parce que vous l’avez demandé : il s’agit de l’exécution d’un
        contrat. Si nous devions un jour nous fonder sur votre consentement, nous
        vous le demanderions clairement et vous pourriez le retirer.
      </p>

      <h2>Durées de conservation</h2>
      <p>
        Les journaux serveur et les rapports d’erreur sont conservés sur une durée
        opérationnelle courte — Sentry conserve les événements 30 jours sur notre
        formule. Les données de compte vivent aussi longtemps que le compte :
        supprimez-le et elles disparaissent. Les e-mails que vous nous adressez
        sont conservés le temps utile à l’échange.
      </p>

      <h2>Vos droits</h2>
      <p>
        Le RGPD vous permet de demander l’accès à vos données, leur rectification,
        leur effacement, la limitation ou l’opposition à leur traitement, ainsi
        qu’une copie portable. Écrivez à{' '}
        <a href={`mailto:${PUBLISHER.privacyEmail}`}>{PUBLISHER.privacyEmail}</a>{' '}
        : nous répondons sous un mois.
      </p>
      <p>
        Si notre réponse ne vous satisfait pas, vous pouvez introduire une
        réclamation auprès de la{' '}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          CNIL
        </a>
        .
      </p>

      <h2>Modifications</h2>
      <p>
        Cette politique peut évoluer. La date affichée en haut correspond toujours
        à la version en vigueur, et les changements significatifs seront signalés
        sur le site.
      </p>
    </ContentPage>
  )
}
