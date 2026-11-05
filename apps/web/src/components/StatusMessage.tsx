// Reader-facing fallback messages for article lists.
//
// These used to be written inline on each page, and they spoke to the
// developer: "Make sure the CMS is running on localhost:3001", "Publish an
// article in the CMS (status = Published)". Readers saw that in production —
// on every page during the October 2026 Railway outage, and on the home page
// whenever there were no articles. Keep anything operational out of here:
// diagnostics belong in Sentry and the logs, not in front of visitors.

function Box({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-8 text-center text-zinc-500">
      <p className="font-medium text-zinc-400">{title}</p>
      {children && <p className="text-sm mt-1">{children}</p>}
    </div>
  )
}

/** The article source failed (CMS down, timeout). Temporary from the reader's side. */
export function ContentUnavailable() {
  return (
    <Box title="Articles are temporarily unavailable.">
      We&apos;re on it — please check back in a few minutes.
    </Box>
  )
}

/** The list loaded fine but is empty. `what` names the kind of content, e.g. "reviews". */
export function NothingYet({ what = 'articles' }: { what?: string }) {
  return (
    <Box title="Nothing here yet.">
      New {what} are on the way — check back soon.
    </Box>
  )
}
