// ─── "Confirm your subscription" email (newsletter double opt-in) ────────────
// Same look as the password-reset email (forgot-password.ts): table layout and
// inline styles, because that's what survives email clients.

const BG = '#09090b'
const SURFACE = '#18181b'
const BORDER = '#27272a'
const TEXT = '#fafafa'
const MUTED = '#a1a1aa'
const ACCENT = '#10b981'

export function newsletterConfirmSubject(): string {
  return 'Confirm your Akavish newsletter subscription'
}

/** Plain-text part, for clients that don't render HTML (and spam filters like one). */
export function newsletterConfirmText(confirmUrl: string): string {
  return [
    'Confirm your Akavish newsletter subscription',
    '',
    'Someone (hopefully you) asked to receive the Akavish newsletter at this address.',
    'Confirm by opening this link:',
    confirmUrl,
    '',
    "Didn't ask for this? Ignore this email: you won't be subscribed, and the",
    'request is deleted after 30 days.',
    '',
    'Akavish · https://akavish.gg',
  ].join('\n')
}

export function newsletterConfirmHTML(confirmUrl: string): string {
  // Built in lib/newsletter.ts from the site origin and a base64url token: no
  // characters that need escaping.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${newsletterConfirmSubject()}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BG};">
    <span style="display:none;font-size:1px;color:${BG};max-height:0;overflow:hidden;">
      One click to start receiving the Akavish newsletter.
    </span>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:${BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:520px;background-color:${SURFACE};border:1px solid ${BORDER};border-radius:12px;">
            <tr>
              <td style="padding:32px 32px 0 32px;">
                <span style="font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:900;color:${TEXT};">Akav</span><span style="font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:900;color:${MUTED};">ish</span>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 0 32px;font-family:Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:700;color:${TEXT};">
                  Confirm your subscription
                </h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">
                  Someone (hopefully you) asked to receive the Akavish newsletter
                  at this address. Confirm and you're in: gaming news, leaks and
                  reviews, no fluff.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:${ACCENT};border-radius:8px;">
                      <a href="${confirmUrl}"
                         style="display:inline-block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${BG};text-decoration:none;">
                        Confirm my subscription
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 0 32px;font-family:Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 6px 0;font-size:13px;line-height:1.6;color:${MUTED};">
                  If the button doesn't work, paste this into your browser:
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="${confirmUrl}" style="color:${ACCENT};text-decoration:underline;">${confirmUrl}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 32px 32px;font-family:Helvetica,Arial,sans-serif;">
                <hr style="border:none;border-top:1px solid ${BORDER};margin:0 0 16px 0;" />
                <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">
                  Didn't ask for this? Ignore this email: you won't be subscribed,
                  and the request is deleted after 30 days.
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#52525b;">
            Akavish · <a href="https://akavish.gg" style="color:#52525b;text-decoration:none;">akavish.gg</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
