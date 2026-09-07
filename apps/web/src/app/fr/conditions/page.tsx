import type { Metadata } from 'next'
import { ContentPage } from '@/components/ContentPage'
import { LegalLanguageSwitch, legalAlternates } from '@/components/LegalLanguageSwitch'
import { LEGAL_LAST_UPDATED, PUBLISHER } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Conditions d’utilisation',
  description: 'Les règles d’utilisation d’Akavish.',
  alternates: legalAlternates('terms', 'fr'),
}

export default function ConditionsPage() {
  return (
    <ContentPage
      title="Conditions d’utilisation"
      subtitle={`Dernière mise à jour : ${LEGAL_LAST_UPDATED.fr}`}
    >
      <LegalLanguageSwitch page="terms" current="fr" />

      <h2>Acceptation</h2>
      <p>
        Ces conditions régissent votre utilisation d’akavish.gg. En naviguant sur
        le site, vous les acceptez. Si vous ne les acceptez pas, n’allez pas plus
        loin. Akavish est édité par {PUBLISHER.name} — voir les{' '}
        <a href="/fr/mentions-legales">mentions légales</a>.
      </p>

      <h2>Utilisation du site</h2>
      <p>
        Lisez, partagez et citez-nous librement. En revanche, n’essayez pas de
        compromettre le service, de le surcharger, d’y accéder sans autorisation,
        de l’aspirer d’une manière qui le dégrade pour les autres, ni de vous en
        servir pour diffuser des contenus illicites.
      </p>

      <h2>Comptes</h2>
      <p>
        Vous êtes responsable de ce qui se passe sous votre compte et de la
        confidentialité de vos identifiants. Un compte utilisé pour nuire au site
        peut être suspendu sans préavis.
      </p>

      <h2>Ligne éditoriale, fuites et rumeurs</h2>
      <p>
        Akavish traite de fuites, de rumeurs et d’informations non confirmées, et
        les signale comme telles. Tout ce qui figure dans la catégorie{' '}
        <em>Leaks</em> est par définition non confirmé : cela reflète ce que des
        sources affirmaient au moment de la rédaction, pas un fait établi. Les
        dates de sortie changent, des projets sont annulés, des sources se
        trompent. N’effectuez aucun achat et ne prenez aucune décision sur cette
        seule base.
      </p>
      <p>
        Nous corrigeons nos erreurs plutôt que de les effacer discrètement. Vous
        en repérez une ?{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>.
      </p>

      <h2>Nos contenus, et ceux des autres</h2>
      <p>
        Les articles, le nom Akavish et nos visuels originaux appartiennent à
        l’éditeur. Vous pouvez en citer de courts extraits avec un crédit visible
        et un lien ; merci de ne pas republier d’articles entiers.
      </p>
      <p>
        Les titres de jeux, logos, captures et bandes-annonces appartiennent à
        leurs éditeurs et développeurs respectifs. Ils apparaissent ici à des fins
        d’information, de critique et de commentaire. Si vous détenez des droits
        sur un contenu utilisé sur le site et souhaitez son retrait, écrivez à{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>{' '}
        : nous interviendrons rapidement.
      </p>

      <h2>Monétisation et transparence</h2>
      <p>
        Akavish est indépendant. Si nous venions à diffuser de la publicité, des
        liens affiliés, des articles sponsorisés, ou à accepter des exemplaires de
        test et des codes presse, nous nous engageons à ce qui suit, conformément
        aux règles françaises sur la publicité déguisée :
      </p>
      <ul className="list-disc ml-6 space-y-1">
        <li>Tout contenu sponsorisé ou rémunéré est signalé comme tel, en début d’article.</li>
        <li>Les liens affiliés sont signalés sur la page qui les contient.</li>
        <li>Les jeux reçus gratuitement sont mentionnés dans le test.</li>
        <li>Aucun annonceur ne relit ni ne valide un contenu éditorial avant publication.</li>
      </ul>
      <p>
        À ce jour, rien de tout cela n’est en place : le site ne comporte ni
        publicité ni lien affilié.
      </p>

      <h2>Liens externes</h2>
      <p>
        Nous renvoyons vers des sources, des boutiques et des réseaux sociaux. Ce
        qui s’y passe relève de leurs propres conditions et politiques de
        confidentialité, pas des nôtres.
      </p>

      <h2>Disponibilité et responsabilité</h2>
      <p>
        Le site est fourni en l’état. Nous ne garantissons ni une disponibilité
        ininterrompue ni l’absence d’erreurs, et nous pouvons modifier ou retirer
        toute partie du site. Dans les limites permises par la loi, nous ne
        saurions être tenus responsables des préjudices indirects résultant de
        votre utilisation du site.
      </p>
      <p>
        Rien dans cette page ne supprime les droits que le droit français et
        européen de la consommation vous accorde : ils s’appliquent quoi qu’il y
        soit écrit.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Les présentes conditions sont régies par le droit français. À défaut de
        résolution amiable, tout litige sera porté devant les juridictions
        françaises compétentes — sans préjudice de votre droit, en tant que
        consommateur, d’agir devant le tribunal de votre lieu de résidence.
      </p>

      <h2>Modifications</h2>
      <p>
        Ces conditions peuvent être mises à jour ; la date en haut de page suit la
        version en vigueur. Questions :{' '}
        <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a>.
      </p>
    </ContentPage>
  )
}
