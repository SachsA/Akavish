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
      lang="fr"
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
        permettre de vous reconnecter, ainsi que les articles que vous
        enregistrez. Si vous vous abonnez à la newsletter, nous
        conservons votre adresse e-mail pour vous l’envoyer, jusqu’à votre
        désinscription. Rien de plus.
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
        et l’avatar que vous choisissez de fournir. Si vous vous connectez avec
        Google, Discord, Twitch ou X, ce service transmet à Clerk votre adresse
        e-mail, votre nom et votre avatar, selon sa propre politique de
        confidentialité ; nous ne voyons jamais votre mot de passe chez lui.
        Notre propre base de données (Neon) conserve une copie du nom, de
        l’adresse e-mail et de l’avatar de votre compte tels que Clerk les
        connaît, votre rôle sur le site (le badge affiché à côté de votre nom,
        par exemple « Author ») et les articles que vous enregistrez, pour les
        afficher sur votre page de compte. Supprimer votre compte supprime tout.
      </p>
      <p>
        <strong>Si vous vous abonnez à la newsletter.</strong> Nous enregistrons
        votre adresse e-mail, la date de votre consentement, l’endroit du site où
        vous vous êtes inscrit et la date de votre confirmation. Rien ne vous est
        envoyé avant que vous ayez cliqué sur le lien de l’e-mail de
        confirmation (double opt-in). L’adresse est stockée dans notre base de
        données (Neon) et les e-mails partent via Resend. Elle ne sert qu’à la
        newsletter : jamais vendue, partagée ni utilisée à des fins
        publicitaires. Chaque newsletter contient un lien de désinscription, et
        se désinscrire supprime votre adresse.
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
        contrat. La newsletter repose sur votre consentement, donné en cochant la
        case du formulaire d’inscription ; vous pouvez le retirer à tout moment
        avec le lien de désinscription ou en nous écrivant.
      </p>

      <h2>Durées de conservation</h2>
      <p>
        Les journaux serveur et les rapports d’erreur sont conservés sur une durée
        opérationnelle courte — Sentry conserve les événements 30 jours sur notre
        formule. Les données de compte vivent aussi longtemps que le compte :
        supprimez-le et elles disparaissent. Un abonnement à la newsletter est
        conservé jusqu’à votre désinscription, qui le supprime aussitôt ; une
        inscription jamais confirmée est supprimée au bout de 30 jours. Les
        e-mails que vous nous adressez sont conservés le temps utile à
        l’échange.
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
