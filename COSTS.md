# What Akavish costs

Monthly running costs, in USD (about the same in EUR). **Update this file
whenever a paid service is added, a plan changes or a real bill comes in**
(replace an estimate with the real figure and its date). Exact amounts live in
each dashboard; the figures marked *est.* are estimates.

Last updated: 2026-11-23.

## Paying now

| Service | What it does | Plan | Per month | Notes |
| --- | --- | --- | --- | --- |
| Domain `akavish.gg` | The site's address | yearly renewal | ~4-5 *est.* | .gg renews at about 50-65 $/year depending on the registrar |
| Railway | CMS + AI scout (`cms.akavish.gg`) | Hobby | ~10-15 *est.* | 5 $ subscription with 5 $ of usage included, then usage (RAM 10 $/GB, CPU 20 $/vCPU). The CMS runs 24/7 |
| Neon | Postgres | **Launch** since 2026-11-19 | ~20 *est.* | Pay as you go, no minimum: 0.106 $/CU-hour, 0.35 $/GB-month, 500 GB transfer included then 0.10 $/GB. Moved off Free after the 5 GB transfer cap was hit (`DEPLOYMENT.md`). The scout queries every 5 min, so the compute never sleeps |
| Vercel | The website (`akavish.gg`) | **Pro** since 2026-11-23 | 20 | One seat. Off Hobby, which is for non-commercial sites, with higher limits (ISR writes, CPU, analytics events). Image optimisation stays off (`DEPLOYMENT.md` §4b) |
| Anthropic API | Scout (triage, drafts, live, recaps), French translations | pay per use | ~15-30 *est.* | Measured 0.5-1 $/day outside big imports. Capped in code: `SCOUT_MONTHLY_BUDGET_USD` (50) + `TRANSLATE_MONTHLY_BUDGET_USD` (30) = 80 $ at most |
| **Total** | | | **~70-90** | |

Not counted above: Alex's own Claude subscription (Pro 20 $, Max 100 $ or
200 $), used to build the site.

## Free for now

| Service | What it does | Free limit to watch |
| --- | --- | --- |
| Cloudflare | DNS, R2 media (`media.akavish.gg`) + backups, email routing | R2: 10 GB storage free, no egress fees |
| Clerk | Reader accounts | Free tier's monthly active users |
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

With the X API and the newsletter: plan on ~120-170 $/month.

## Log

- 2026-11-23: Vercel Hobby → Pro (20 $/month).
- 2026-11-19: site cache refresh made targeted, timers 5 min / 1 h (Vercel ISR writes were at 137K of 200K, CPU at 2h23 of 4h): stays on Hobby.
- 2026-11-19: Neon Free → Launch (5 GB transfer cap reached on day 9 after launch).
- 2026-11-18: Vercel image optimisation turned off (75 % of the 5,000 free transformations used in a week); images now come straight from R2.
