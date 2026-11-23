# What Akavish costs

Monthly running costs, in USD (about the same in EUR). **Update this file
whenever a paid service is added, a plan changes or a real bill comes in**
(replace an estimate with the real figure and its date). Exact amounts live in
each dashboard; the figures marked *est.* are estimates.

Last updated: 2026-11-23.

## Paying now

Real bills checked with Alex on 2026-11-23. French VAT (20 %) is added where
the provider charges it, so a "25 $" plan shows up as 30 $ on the card.

| Service | What it does | How it's billed | Per month | Notes |
| --- | --- | --- | --- | --- |
| Domain `akavish.gg` | The site's address | **yearly** (Porkbun) | ~4.2 | 50.80 $ paid on 2026-08-17, renews each August |
| Vercel | The website (`akavish.gg`) | **Pro since 2026-11-23**: 20 $ every month (on the 23rd) | 20 | The 20 $ include 20 $ of usage credit; only usage beyond it is billed on top. First day: 0.44 $ used. Image optimisation stays off (`DEPLOYMENT.md` §4b), pushes that don't touch the site don't build (§3) |
| Clerk | Reader accounts | **monthly** (on the 10th) | 30 | 30 $ paid on 2026-11-10 (looks like Pro, 25 $ + VAT). Check the plan in Clerk → Billing: the free tier may cover the site for now |
| Railway | CMS + AI scout (`cms.akavish.gg`) | Hobby: 5 $ minimum a month with 5 $ of usage included, then usage (on the 25th) | ~6 | Invoices: 6 $ (Aug), 1 $ (Sep), 6 $ (Oct). November's (Nov 25) is the first with the scout on all month |
| Neon | Postgres | **Launch since 2026-11-19**: usage only, no fixed fee (on the 1st) | ~0-5 | 0.01 $ for Nov 19-23 (24.7 compute hours). Moved off Free after the 5 GB transfer cap was hit (`DEPLOYMENT.md`) |
| Anthropic API | Scout (triage, drafts, live, recaps), French translations | **prepaid credit**, auto top-up when the balance runs low | ~10-20 | 9.58 $ spent Nov 1-23, launch week and live rehearsal included. The 24 $ of Nov 10 was credit bought (20 $ + VAT), not a monthly fee. Capped in code: `SCOUT_MONTHLY_BUDGET_USD` (50) + `TRANSLATE_MONTHLY_BUDGET_USD` (30), and 50 $/month in the console |
| **Total** | | | **~70-85** | |

Not counted above: Alex's own Claude subscription (Pro, 21.60 € a month with
VAT, on the 29th), used to build the site.

## Free for now

| Service | What it does | Free limit to watch |
| --- | --- | --- |
| Cloudflare | DNS, R2 media (`media.akavish.gg`) + backups, email routing | R2: 10 GB storage free, no egress fees |
| Resend | Newsletter confirmation emails | 100 emails/day |
| Sentry | Error tracking | Free tier's events/month |
| UptimeRobot | Uptime checks (web + CMS) | Free plan |
| GitHub | Code, CI, backup workflow | Free for this repo |
| Discord | Scout bot, channels | Free |

## Coming when we turn them on

| What | For | Estimated cost |
| --- | --- | --- |
| X API | Scout step 3 (leakers), "Sign in with X" | Pay per use, ~0.005 $ per post read: ~20-90 $/month for about 30 accounts |
| Meilisearch Cloud | Faster, typo-tolerant search (+ French index) | Usage based, probably ~30 $/month and up (exact price in their console) |
| Resend paid | Sending the newsletter past ~100 emails/day | ~20 $/month |
| Esport data | Scout step 4 (results, schedules) | Liquipedia free, PandaScore paid: compare first |
| Staging | A copy of the site to test on | ~5-10 $/month (Railway service + Neon branch) |
| Mobile app stores | Publishing the app | Apple 99 $/year, Google Play 25 $ once |
| Legal review | Legal pages checked by a lawyer | One-off |

With the X API and the newsletter: plan on ~120-170 $/month (less if Clerk goes back to free).

## Log

- 2026-11-23: real bills in: Railway ~6 $ (not 10-15), Neon ~0 so far (not ~20), Anthropic ~10-20 $, domain 50.80 $/year, and Clerk 30 $/month since 2026-11-10 (was listed as free).
- 2026-11-23: Vercel Hobby → Pro (20 $/month). First day: 0.38 $ of usage, 0.31 $ of it build minutes, so pushes that don't touch the site no longer build it (`DEPLOYMENT.md` §3).
- 2026-11-19: site cache refresh made targeted, timers 5 min / 1 h (Vercel ISR writes were at 137K of 200K, CPU at 2h23 of 4h): stays on Hobby.
- 2026-11-19: Neon Free → Launch (5 GB transfer cap reached on day 9 after launch).
- 2026-11-18: Vercel image optimisation turned off (75 % of the 5,000 free transformations used in a week); images now come straight from R2.
