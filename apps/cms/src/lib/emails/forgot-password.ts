// ─── "Forgot password" email (CMS editors) ───────────────────────────────────
// Payload ships a plain-text-ish default for this email. These helpers replace
// it with a branded HTML version, wired in `collections/Users.ts`.
//
// Reader accounts are Clerk's business — this only ever goes to CMS editors.

import type { PayloadRequest } from 'payload'

/**
 * How long a reset link stays valid. Payload's own default is also 1 hour, but
 * it's set explicitly here so the config and the "expires in one hour" line in
 * the email body can't quietly drift apart.
 */
export const FORGOT_PASSWORD_EXPIRATION_MS = 60 * 60 * 1000

// Brand palette — kept in sync with the web app's OG image
// (`apps/web/src/app/article/[slug]/opengraph-image.tsx`).
const BG = '#09090b'
const SURFACE = '#18181b'
const BORDER = '#27272a'
const TEXT = '#fafafa'
const MUTED = '#a1a1aa'
const ACCENT = '#10b981'

type ForgotPasswordArgs = {
  req?: PayloadRequest
  token?: string
  user?: { email?: string }
}

/** Escape the few characters that could break out of the HTML we build. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Absolute URL of the admin reset form — the same one Payload's default email
 * points at. Prefers the running config over the env var so it stays correct in
 * any environment.
 */
function resetUrl(req: ForgotPasswordArgs['req'], token: string): string {
  const serverURL =
    req?.payload?.config?.serverURL || process.env.SERVER_URL || 'http://localhost:3001'
  return `${serverURL}/admin/reset/${token}`
}

export function forgotPasswordSubject(): string {
  return 'Reset your Akavish CMS password'
}

export function forgotPasswordHTML(args?: ForgotPasswordArgs): string {
  const token = args?.token
  const email = args?.user?.email

  // Payload types `token` as optional. It is always present in practice, but if
  // it ever isn't, send someone to the login screen rather than a broken link.
  const url = token
    ? resetUrl(args?.req, token)
    : `${args?.req?.payload?.config?.serverURL || process.env.SERVER_URL || 'http://localhost:3001'}/admin`

  const greeting = email
    ? `A password reset was requested for <strong style="color:${TEXT};">${escapeHtml(email)}</strong>.`
    : 'A password reset was requested for your account.'

  // Table-based layout with inline styles: <div>/flex/<style> are unreliable
  // across email clients (Outlook in particular).
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Reset your Akavish CMS password</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BG};">
    <!-- Preview text shown in the inbox list, hidden in the body. -->
    <span style="display:none;font-size:1px;color:${BG};max-height:0;overflow:hidden;">
      Reset your Akavish CMS password — this link expires in one hour.
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
                  Reset your password
                </h1>
                <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:${MUTED};">
                  ${greeting}
                </p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">
                  Click the button below to choose a new one. The link expires in
                  <strong style="color:${TEXT};">one hour</strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:${ACCENT};border-radius:8px;">
                      <a href="${url}"
                         style="display:inline-block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${BG};text-decoration:none;">
                        Reset password
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
                  <a href="${url}" style="color:${ACCENT};text-decoration:underline;">${url}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 32px 32px;font-family:Helvetica,Arial,sans-serif;">
                <hr style="border:none;border-top:1px solid ${BORDER};margin:0 0 16px 0;" />
                <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">
                  Didn't ask for this? Ignore this email — your password stays unchanged.
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
