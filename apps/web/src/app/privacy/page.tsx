import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage } from '@/components/ContentPage'
import { ProcessorTable } from '@/components/ProcessorTable'
import { LegalLanguageSwitch, legalAlternates } from '@/components/LegalLanguageSwitch'
import { LEGAL_LAST_UPDATED, PUBLISHER } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What data Akavish collects, who processes it, and your rights.',
  alternates: legalAlternates('privacy', 'en'),
}

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy Policy" subtitle={`Last updated: ${LEGAL_LAST_UPDATED.en}`}>
      <LegalLanguageSwitch page="privacy" current="en" />

      <h2>The short version</h2>
      <p>
        Reading Akavish requires no account and no tracking. We do not sell or
        share your data for advertising, we do not build profiles of readers, and
        we do not use advertising cookies. If you create an account, we hold your
        email address so you can log back in, and the articles you save. If you subscribe to the newsletter,
        we hold your email address to send it, until you unsubscribe. Nothing
        more.
      </p>

      <h2>Who is responsible</h2>
      <p>
        Akavish is published by {PUBLISHER.name}, who is the data controller for
        the purposes of the GDPR. Contact:{' '}
        <a href={`mailto:${PUBLISHER.privacyEmail}`}>{PUBLISHER.privacyEmail}</a>.
        Publisher and hosting details are on the{' '}
        <Link href="/legal">legal notice</Link>.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>When you simply read the site.</strong> Our host records standard
        server logs, which include your IP address. We measure audience with
        Vercel Web Analytics, which is cookieless: it counts page views and
        approximate country without identifying you or following you across
        sites. If a page fails, an error report is sent to Sentry — configured to
        exclude your IP address, cookies, headers and any form content.
      </p>
      <p>
        <strong>If you create an account.</strong> Sign-up and login are handled
        by Clerk. It holds your email address and whatever name or avatar you
        choose to provide. If you sign in with Google, Discord, Twitch or X, that
        service tells Clerk your email address, name and avatar, under its own
        privacy policy; we never see your password there. Our own database
        (Neon) keeps a copy of your account’s name, email address and avatar
        as Clerk has them, your role on the site (the badge shown next to your
        name, such as “Author”) and the articles you save, so we can show them on
        your account page.
      </p>
      <p>
        <strong>If you comment.</strong> Your public name (your username, or
        your first name if you have none), your comment, its date and your badge
        are public under the article. We also keep your likes and dislikes, and
        the reports you make (which comment, the reason, your note). When a
        comment is reported, its text and the reason are sent to our private
        moderation channel on Discord, without anyone&rsquo;s name. You can delete
        your own comments at any time. Deleting your account deletes all of it:
        a comment others replied to stays as &ldquo;Comment deleted&rdquo;,
        without your name or your text.
      </p>
      <p>
        <strong>If you subscribe to the newsletter.</strong> We store your email
        address, when you gave your consent, where on the site you signed up, and
        when you confirmed. Nothing is sent until you click the link in the
        confirmation email we send you (double opt-in). The address is stored in
        our database (Neon) and the emails are sent through Resend. It is used
        for the newsletter only: never sold, shared or used for advertising.
        Every newsletter carries an unsubscribe link, and unsubscribing deletes
        your address.
      </p>
      <p>
        <strong>If you email us.</strong> Messages sent to an @akavish.gg address
        are forwarded to a personal mailbox through Cloudflare Email Routing. We
        keep them for as long as needed to deal with your message.
      </p>
      <p>
        We do not knowingly collect anything from children under 15, the age of
        digital consent in France.
      </p>

      <h2>Cookies</h2>
      <p>
        Akavish sets <strong>only strictly necessary cookies</strong>, placed by
        Clerk to keep you signed in and to protect the login form. There are no
        advertising, profiling or audience-measurement cookies — which is why you
        are not greeted by a consent banner. You can block cookies in your
        browser; the site will still work, but you will not be able to log in.
      </p>

      <h2>Who processes your data</h2>
      <p>
        We keep the list of third parties deliberately short. Each one acts on our
        instructions, for the purpose stated:
      </p>
      <ProcessorTable lang="en" />
      <p>
        Several of these are based in the United States, so your data may be
        transferred outside the EEA. Those transfers rely on the European
        Commission’s Standard Contractual Clauses and, where applicable, the EU–US
        Data Privacy Framework.
      </p>

      <h2>Why we are allowed to do this</h2>
      <p>
        Serving the site and keeping it secure and working rests on our legitimate
        interest in running a functioning publication. Your account exists because
        you asked for it — that is performance of a contract; so are your
        comments and votes. Moderating comments rests on our legitimate interest
        in a civil discussion and on our legal duty to remove illegal content
        once it is reported to us. The newsletter
        rests on your consent, given by ticking the box on the sign-up form; you
        can withdraw it at any time with the unsubscribe link or by writing to
        us.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Server logs and error reports are kept for a short operational period —
        Sentry retains events for 30 days on our plan. Account data lives for as
        long as your account does; delete it and it goes. A comment stays until
        you delete it, a moderator removes it or your account goes; reports go
        with the comment. A newsletter
        subscription is kept until you unsubscribe, which deletes it at once; a
        sign-up you never confirm is deleted after 30 days. Emails you send us
        are kept while the conversation is useful.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the GDPR you may request access to your data, correct it, delete it,
        restrict or object to its processing, and receive a portable copy. Write
        to <a href={`mailto:${PUBLISHER.privacyEmail}`}>{PUBLISHER.privacyEmail}</a>{' '}
        and we will answer within one month.
      </p>
      <p>
        If you are not satisfied with our answer, you may lodge a complaint with
        your national supervisory authority — in France, the{' '}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          CNIL
        </a>
        .
      </p>

      <h2>Changes</h2>
      <p>
        We may revise this policy. The date at the top always reflects the current
        version, and significant changes will be noted on the site.
      </p>
    </ContentPage>
  )
}
