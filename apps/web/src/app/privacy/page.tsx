import type { Metadata } from 'next'
import { ContentPage } from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Akavish handles your data.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy Policy" subtitle="Last updated: June 2026">
      <p className="text-sm text-zinc-500 border border-zinc-800 rounded-md p-3">
        ⚠️ This is a starting template, not legal advice. Have it reviewed by a
        qualified professional before launch.
      </p>

      <h2>Who we are</h2>
      <p>
        Akavish (&quot;we&quot;, &quot;us&quot;) operates this website. This
        policy explains what data we collect and how we use it.
      </p>

      <h2>Data we collect</h2>
      <p>
        <strong>Account data.</strong> If you sign up, authentication is handled
        by our provider (Clerk), which stores your email and login credentials on
        our behalf.
      </p>
      <p>
        <strong>Usage data.</strong> We may collect anonymized analytics (pages
        visited, device, approximate location) to understand how the site is
        used.
      </p>

      <h2>How we use it</h2>
      <p>
        To provide and secure your account, improve the site, and communicate
        with you when you ask us to. We do not sell your personal data.
      </p>

      <h2>Cookies</h2>
      <p>
        We use essential cookies for authentication and, if enabled, analytics
        cookies. You can control cookies through your browser settings.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on your location, you may have the right to access, correct or
        delete your data. To make a request, email{' '}
        <a href="mailto:privacy@akavish.gg">privacy@akavish.gg</a>.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. Material changes will be reflected by the
        &quot;last updated&quot; date above.
      </p>
    </ContentPage>
  )
}
